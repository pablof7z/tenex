import { NDKEvent } from "@nostr-dev-kit/ndk";
import type { TenexNDK } from "./ndk-setup.js";
import {
    type ChatSession,
    EVENT_KINDS,
    type ProjectAgent,
    type TenexProject,
    type ThreadEvent,
    type TypingIndicator,
} from "./types.js";

export class TenexChat {
    private ndk: TenexNDK;
    private session: ChatSession;

    constructor(ndk: TenexNDK, project: TenexProject) {
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

            this.ndk.subscribe(filters, (event) => {
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
                console.log(
                    `🤖 Discovered ${agents.length} agents:`,
                    agents.map((a) => a.name).join(", ")
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
        const event = new NDKEvent(this.ndk.ndk);
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

        await this.ndk.publishEvent(event);

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
        console.log(`🧵 Created thread: "${title}"`);

        return threadEvent;
    }

    async replyToThread(content: string, mentionedAgents: string[] = []): Promise<void> {
        if (!this.session.currentThread) {
            throw new Error("No active thread to reply to");
        }

        const event = new NDKEvent(this.ndk.ndk);
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

        await this.ndk.publishEvent(event);
        console.log("💬 Replied to thread");
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
                console.warn(`⚠️  Agent "${agentName}" not found`);
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

        await this.ndk.subscribe(filters, onMessage);
        console.log(`👂 Listening for replies to thread: ${threadId}`);
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

        await this.ndk.subscribe(filters, (event) => {
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

        console.log(`⌨️  Listening for typing indicators in thread: ${threadId}`);
    }

    getSession(): ChatSession {
        return this.session;
    }
}
