import type { ConversationMessage } from "@/utils/agents/types";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";

import type { ConversationMetadata } from "@tenex/types/conversations";

// Internal conversation state used by the Conversation class
interface InternalConversationState {
    id: string;
    agentName: string;
    messages: ConversationMessage[];
    createdAt: number;
    lastActivityAt: number;
    metadata?: ConversationMetadata;
}

export class Conversation {
    private context: InternalConversationState;
    private participants: Set<string> = new Set(); // Track participant pubkeys

    constructor(id: string, agentName: string, systemPrompt?: string) {
        this.context = {
            id,
            agentName,
            messages: [],
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
        };

        if (systemPrompt) {
            this.addMessage({
                id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                role: "system",
                content: systemPrompt,
                timestamp: Date.now(),
            });
        }
    }

    getId(): string {
        return this.context.id;
    }

    getAgentName(): string {
        return this.context.agentName;
    }

    addMessage(message: ConversationMessage): void {
        this.context.messages.push(message);
        this.context.lastActivityAt = Date.now();
    }

    addUserMessage(content: string, event?: NDKEvent): void {
        logger.debug(
            `[Conversation ${this.getId()}] Adding user message: "${content.substring(0, 100)}..."`
        );
        this.addMessage({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            role: "user",
            content,
            event,
            timestamp: Date.now(),
        });

        // Track the author as a participant
        if (event?.author?.pubkey) {
            this.addParticipant(event.author.pubkey);
        }

        // Track any p-tagged pubkeys as participants
        if (event?.tags) {
            const pTags = event.tags.filter((tag) => tag[0] === "p");
            for (const pTag of pTags) {
                if (pTag[1]) {
                    this.addParticipant(pTag[1]);
                }
            }
        }
        logger.debug(
            `[Conversation ${this.getId()}] Total messages after adding user message: ${this.getMessageCount()}`
        );
    }

    addAssistantMessage(content: string): void {
        this.addMessage({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            role: "assistant",
            content,
            timestamp: Date.now(),
        });
    }

    getMessages(): ConversationMessage[] {
        return [...this.context.messages];
    }

    getMessageCount(): number {
        return this.context.messages.length;
    }

    getLastActivityTime(): number {
        return this.context.lastActivityAt;
    }

    getFormattedMessages(): Array<{ role: string; content: string }> {
        const formatted = this.context.messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
        }));
        logger.debug(
            `[Conversation ${this.getId()}] returning ${formatted.length} formatted messages`
        );
        return formatted;
    }

    setMetadata(key: string, value: unknown): void {
        if (!this.context.metadata) {
            this.context.metadata = {};
        }
        this.context.metadata[key] = value;
    }

    getMetadata(key: string): unknown {
        return this.context.metadata?.[key];
    }

    getAllMetadata(): Record<string, unknown> | undefined {
        return this.context.metadata;
    }

    addParticipant(pubkey: string): void {
        this.participants.add(pubkey);
    }

    getParticipants(): string[] {
        return Array.from(this.participants);
    }

    isParticipant(pubkey: string): boolean {
        return this.participants.has(pubkey);
    }

    getParticipantCount(): number {
        return this.participants.size;
    }

    toJSON(): InternalConversationState {
        // Create a deep copy and convert NDKEvents to raw events
        const serializable: InternalConversationState = {
            ...this.context,
            messages: this.context.messages.map((msg) => ({
                ...msg,
                event: msg.event
                    ? // Check if it's an NDKEvent instance with rawEvent method
                      this.isNDKEvent(msg.event)
                        ? msg.event.rawEvent()
                        : msg.event // Already a raw event object
                    : undefined,
            })),
            metadata: {
                ...this.context.metadata,
                participants: this.getParticipants(),
            },
        };
        return serializable;
    }

    private isNDKEvent(event: unknown): event is NDKEvent {
        return (
            typeof event === "object" &&
            event !== null &&
            typeof (event as NDKEvent).rawEvent === "function"
        );
    }

    static fromJSON(data: InternalConversationState): Conversation {
        const conversation = new Conversation(data.id, data.agentName);
        conversation.context = data;

        // Restore participants from metadata
        const participants = data.metadata?.participants;
        if (Array.isArray(participants)) {
            for (const pubkey of participants) {
                conversation.addParticipant(pubkey);
            }
        }

        return conversation;
    }
}
