import path from "node:path";
import {
    type TracingContext,
    createPhaseExecutionContext,
    createTracingContext,
    createTracingLogger,
} from "@/tracing";
import type { PhaseTransition } from "@/conversations/types";
import type { Phase } from "@/conversations/phases";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";
import { ensureDirectory, fileExists, readFile, writeJsonFile } from "@/lib/fs";
import { FileSystemAdapter } from "./persistence";
import type { ConversationMetadata, Conversation } from "./types";
import { isEventFromUser } from "@/nostr/utils";

export class ConversationManager {
    private conversations: Map<string, Conversation> = new Map();
    private conversationContexts: Map<string, TracingContext> = new Map();
    private conversationsDir: string;
    private persistence: FileSystemAdapter;

    constructor(private projectPath: string) {
        this.conversationsDir = path.join(projectPath, ".tenex", "conversations");
        this.persistence = new FileSystemAdapter(projectPath);
    }

    getProjectPath(): string {
        return this.projectPath;
    }

    async initialize(): Promise<void> {
        await ensureDirectory(this.conversationsDir);
        await this.persistence.initialize();

        // Load existing conversations
        await this.loadConversations();
    }

    async createConversation(event: NDKEvent): Promise<Conversation> {
        const id = event.id;
        if (!id) {
            throw new Error("Event must have an ID to create a conversation");
        }
        const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled Conversation";

        // Create tracing context for this conversation
        const tracingContext = createTracingContext(id);
        this.conversationContexts.set(id, tracingContext);

        const tracingLogger = createTracingLogger(tracingContext, "conversation");
        tracingLogger.startOperation("createConversation");

        const conversation: Conversation = {
            id,
            title,
            phase: "chat", // All conversations start in chat phase
            history: [event],
            phaseStartedAt: Date.now(),
            metadata: {
                summary: event.content,
            },
            phaseTransitions: [], // Initialize empty phase transitions array
        };

        this.conversations.set(id, conversation);
        tracingLogger.info(`Created new conversation: ${title}`, {
            title,
            phase: "chat",
            event: "conversation_created",
        });

        // Save immediately after creation
        await this.persistence.save(conversation);

        tracingLogger.completeOperation("createConversation");

        return conversation;
    }

    getConversation(id: string): Conversation | undefined {
        return this.conversations.get(id);
    }

    async updatePhase(
        id: string, 
        phase: Phase, 
        message: string,
        agentPubkey: string,
        agentName: string,
        reason?: string
    ): Promise<void> {
        const conversation = this.conversations.get(id);
        if (!conversation) {
            throw new Error(`Conversation ${id} not found`);
        }

        // Get or create tracing context
        let tracingContext = this.conversationContexts.get(id);
        if (!tracingContext) {
            tracingContext = createTracingContext(id);
            this.conversationContexts.set(id, tracingContext);
        }

        // Create phase execution context
        const phaseContext = createPhaseExecutionContext(tracingContext, phase);
        const tracingLogger = createTracingLogger(phaseContext, "conversation");

        const previousPhase = conversation.phase;

        // Check if phase is actually changing
        if (previousPhase === phase) {
            // Log staying in same phase
            tracingLogger.info(`[CONVERSATION] Staying in phase "${phase}"`, {
                phase,
                conversationTitle: conversation.title,
                message: message.substring(0, 100) + '...',
            });
            return;
        }

        // Create phase transition record
        const transition: PhaseTransition = {
            from: previousPhase,
            to: phase,
            message,
            timestamp: Date.now(),
            agentPubkey,
            agentName,
            reason
        };

        // Update conversation
        conversation.phase = phase;
        conversation.phaseStartedAt = Date.now();
        
        conversation.phaseTransitions.push(transition);

        tracingLogger.logTransition(previousPhase, phase, {
            message: message.substring(0, 100) + '...', // Log preview
            conversationTitle: conversation.title,
        });

        // Save after phase update
        await this.persistence.save(conversation);
    }

    async addEvent(conversationId: string, event: NDKEvent): Promise<void> {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }

        // Get or create tracing context
        let tracingContext = this.conversationContexts.get(conversationId);
        if (!tracingContext) {
            tracingContext = createTracingContext(conversationId);
            this.conversationContexts.set(conversationId, tracingContext);
        }

        const tracingLogger = createTracingLogger(tracingContext, "conversation");

        conversation.history.push(event);

        // Update the conversation summary to include the latest message
        // This ensures other parts of the system have access to updated context
        if (event.content) {
            const isUser = isEventFromUser(event);
            if (isUser) {
                // For user messages, update the summary to be more descriptive
                conversation.metadata.summary = event.content;
                conversation.metadata.last_user_message = event.content;
            }

            tracingLogger.logEventReceived(
                event.id || "unknown",
                isUser ? "user_message" : "agent_response",
                {
                    phase: conversation.phase,
                    historyLength: conversation.history.length,
                }
            );
        }

        // Save after adding event
        await this.persistence.save(conversation);
    }


    async updateMetadata(
        conversationId: string,
        metadata: Partial<ConversationMetadata>
    ): Promise<void> {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }

        conversation.metadata = {
            ...conversation.metadata,
            ...metadata,
        };
    }

    getPhaseHistory(conversationId: string): NDKEvent[] {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) {
            return [];
        }

        // Return events from current phase only
        // For now, return all events - phase filtering can be added later
        // when we implement phase transition events
        return conversation.history;
    }


    getAllConversations(): Conversation[] {
        return Array.from(this.conversations.values());
    }

    getConversationByEvent(eventId: string): Conversation | undefined {
        // Find conversation that contains this event
        for (const conversation of this.conversations.values()) {
            if (conversation.history.some((e) => e.id === eventId)) {
                return conversation;
            }
        }
        return undefined;
    }

    // Persistence methods
    private async loadConversations(): Promise<void> {
        try {
            const metadata = await this.persistence.list();
            let loadedCount = 0;

            for (const meta of metadata) {
                if (!meta.archived) {
                    const conversation = await this.persistence.load(meta.id);
                    if (conversation) {
                        this.conversations.set(meta.id, conversation);
                        loadedCount++;
                    }
                }
            }
        } catch (error) {
            logger.error("Failed to load conversations", { error });
        }
    }

    private async saveAllConversations(): Promise<void> {
        const promises: Promise<void>[] = [];

        for (const conversation of this.conversations.values()) {
            promises.push(this.persistence.save(conversation));
        }

        await Promise.all(promises);
    }

    async saveConversation(conversationId: string): Promise<void> {
        const conversation = this.conversations.get(conversationId);
        if (conversation) {
            await this.persistence.save(conversation);
        }
    }

    async archiveConversation(conversationId: string): Promise<void> {
        await this.persistence.archive(conversationId);
        this.conversations.delete(conversationId);
    }

    async searchConversations(query: string): Promise<Conversation[]> {
        const metadata = await this.persistence.search({ title: query });
        const conversations: Conversation[] = [];

        for (const meta of metadata) {
            const conversation = await this.persistence.load(meta.id);
            if (conversation) {
                conversations.push(conversation);
            }
        }

        return conversations;
    }

    async cleanup(): Promise<void> {
        // Save all conversations before cleanup
        await this.saveAllConversations();
    }

    /**
     * Get the tracing context for a conversation
     */
    getTracingContext(conversationId: string): TracingContext | undefined {
        return this.conversationContexts.get(conversationId);
    }
}
