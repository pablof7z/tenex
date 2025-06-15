import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";
import {
    type ChatSession,
    EVENT_KINDS,
    type ProjectAgent,
    type TenexProject,
    type ThreadEvent,
    type TypingIndicator,
} from "./types.js";

export class TenexChat {
    private ndk: NDK;
    private session: ChatSession;

    constructor(ndk: NDK, project: TenexProject) {
        this.ndk = ndk;
        this.session = {
            project,
            agents: [],
            typingIndicators: new Map(),
        };
    }

    async discoverAgents(): Promise<ProjectAgent[]> {
        const projectTagId = `31933:${this.session.project.pubkey}:${this.session.project.identifier}`;

        const filters = [
            {
                kinds: [EVENT_KINDS.PROJECT_STATUS],
                "#a": [projectTagId],
                limit: 1,
            },
        ];

        return new Promise((resolve) => {
            const agents: ProjectAgent[] = [];

            const sub = this.ndk.subscribe(filters);
            sub.on("event", (event) => {
                for (const tag of event.tags) {
                    if (tag[0] === "p" && tag.length >= 3) {
                        const existingAgent = agents.find((a) => a.pubkey === tag[1]);
                        if (!existingAgent) {
                            agents.push({
                                pubkey: tag[1],
                                name: tag[2],
                            });
                        }
                    }
                }

                this.session.agents = agents;
                logger.info(
                    `🤖 Discovered ${agents.length} agents: ${agents.map((a) => a.name).join(", ")}`
                );
                resolve(agents);
            });

            setTimeout(() => {
                resolve(agents);
            }, 3000);
        });
    }

    async createThread(
        title: string,
        content: string,
        mentionedAgents: string[] = []
    ): Promise<ThreadEvent> {
        const event = new NDKEvent(this.ndk);
        event.kind = EVENT_KINDS.CHAT;
        event.content = content;

        const projectTagId = `31933:${this.session.project.pubkey}:${this.session.project.identifier}`;

        event.tags = [
            ["title", title],
            ["a", projectTagId],
        ];

        const mentionedPubkeys = this.resolveMentions(mentionedAgents);
        for (const pubkey of mentionedPubkeys) {
            event.tags.push(["p", pubkey]);
        }

        await event.sign();
        await event.publish();

        const threadEvent: ThreadEvent = {
            id: event.id!,
            pubkey: event.pubkey!,
            content: event.content!,
            created_at: event.created_at!,
            kind: event.kind!,
            tags: event.tags,
            title,
        };

        this.session.currentThread = threadEvent;
        logger.info(`🧵 Created thread: "${title}"`);

        return threadEvent;
    }

    async replyToThread(content: string, mentionedAgents: string[] = []): Promise<void> {
        if (!this.session.currentThread) {
            throw new Error("No active thread to reply to");
        }

        const event = new NDKEvent(this.ndk);
        event.kind = EVENT_KINDS.THREAD_REPLY;
        event.content = content;

        const projectTagId = `31933:${this.session.project.pubkey}:${this.session.project.identifier}`;

        event.tags = [
            ["e", this.session.currentThread.id],
            ["a", projectTagId],
        ];

        const mentionedPubkeys = this.resolveMentions(mentionedAgents);
        for (const pubkey of mentionedPubkeys) {
            event.tags.push(["p", pubkey]);
        }

        await event.sign();
        await event.publish();
        logger.info("💬 Replied to thread");
    }

    private resolveMentions(mentionedAgents: string[]): string[] {
        const pubkeys: string[] = [];

        for (const agentName of mentionedAgents) {
            const agent = this.session.agents.find(
                (a) => a.name.toLowerCase() === agentName.toLowerCase()
            );
            if (agent) {
                pubkeys.push(agent.pubkey);
            } else {
                logger.warn(`⚠️  Agent "${agentName}" not found`);
            }
        }

        return pubkeys;
    }

    extractMentions(content: string): { cleanContent: string; mentionedAgents: string[] } {
        const mentionRegex = /@(\w+)/g;
        const mentionedAgents: string[] = [];

        const matches = content.matchAll(mentionRegex);
        for (const match of matches) {
            const mentionName = match[1];
            if (!mentionedAgents.includes(mentionName)) {
                mentionedAgents.push(mentionName);
            }
        }

        return { cleanContent: content, mentionedAgents };
    }

    async subscribeToThread(threadId: string, onMessage: (event: NDKEvent) => void): Promise<void> {
        const filters = [
            {
                kinds: [EVENT_KINDS.THREAD_REPLY],
                "#e": [threadId],
            },
        ];

        const sub = this.ndk.subscribe(filters);
        sub.on("event", onMessage);
        logger.info(`👂 Listening for replies to thread: ${threadId}`);
    }

    async subscribeToTypingIndicators(
        threadId: string,
        onTyping: (indicator: TypingIndicator) => void
    ): Promise<void> {
        const filters = [
            {
                kinds: [EVENT_KINDS.TYPING_INDICATOR, EVENT_KINDS.TYPING_INDICATOR_STOP],
                "#e": [threadId],
                since: Math.floor(Date.now() / 1000) - 60,
            },
        ];

        const sub = this.ndk.subscribe(filters);
        sub.on("event", (event) => {
            const agentName =
                this.session.agents.find((a) => a.pubkey === event.pubkey)?.name || "Unknown";
            const systemPrompt = event.tags.find((tag) => tag[0] === "system-prompt")?.[1];
            const userPrompt = event.tags.find((tag) => tag[0] === "prompt")?.[1];

            const indicator: TypingIndicator = {
                id: event.id!,
                pubkey: event.pubkey!,
                content: event.content!,
                created_at: event.created_at!,
                kind: event.kind!,
                tags: event.tags,
                agentName,
                systemPrompt,
                userPrompt,
            };

            if (event.kind === EVENT_KINDS.TYPING_INDICATOR) {
                this.session.typingIndicators.set(event.pubkey!, indicator);
            } else {
                this.session.typingIndicators.delete(event.pubkey!);
            }

            onTyping(indicator);
        });

        logger.info(`⌨️  Listening for typing indicators in thread: ${threadId}`);
    }

    getSession(): ChatSession {
        return this.session;
    }
}
