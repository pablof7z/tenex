import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { Conversation } from "../Conversation";
import type { ConversationStorage } from "../ConversationStorage";
import type { SystemPromptContext } from "../prompts/types";
import type { AgentCore } from "./AgentCore";

export class AgentConversationManager {
    private conversations: Map<string, Conversation>;
    private storage?: ConversationStorage;
    private agentCore: AgentCore;

    constructor(agentCore: AgentCore, storage?: ConversationStorage) {
        this.agentCore = agentCore;
        this.conversations = new Map();
        this.storage = storage;
    }

    getConversation(conversationId: string): Conversation | undefined {
        return this.conversations.get(conversationId);
    }

    async getOrCreateConversationWithContext(
        conversationId: string,
        context: Partial<SystemPromptContext>
    ): Promise<Conversation> {
        let conversation = this.conversations.get(conversationId);

        if (!conversation && this.storage) {
            // Try to load from storage
            const stored = await this.storage.loadConversation(
                conversationId,
                this.agentCore.getName()
            );
            if (stored && stored.agentName === this.agentCore.getName()) {
                conversation = Conversation.fromJSON(stored);
                this.conversations.set(conversationId, conversation);
            }
        }

        if (!conversation) {
            // Create new conversation with full context
            const systemPrompt = this.agentCore.buildSystemPromptWithContext(context);
            conversation = new Conversation(conversationId, this.agentCore.getName(), systemPrompt);
            this.conversations.set(conversationId, conversation);

            // Save to storage if available
            if (this.storage) {
                await this.storage.saveConversation(conversation.toJSON());
            }

            this.agentCore
                .getLogger()
                .info(`Created new conversation ${conversationId} with full context`);
        }

        return conversation;
    }

    getAllConversations(): Map<string, Conversation> {
        return new Map(this.conversations);
    }

    removeConversation(conversationId: string): boolean {
        return this.conversations.delete(conversationId);
    }

    extractConversationId(event: NDKEvent): string {
        const eTag = event.tags.find((tag) => tag[0] === "e");
        if (eTag?.[1]) {
            return eTag[1];
        }

        const rootTag = event.tags.find((tag) => tag[0] === "root");
        if (rootTag?.[1]) {
            return rootTag[1];
        }

        return event.id;
    }

    async saveConversationToStorage(conversation: Conversation): Promise<void> {
        if (this.storage) {
            await this.storage.saveConversation(conversation.toJSON());
        }
    }
}
