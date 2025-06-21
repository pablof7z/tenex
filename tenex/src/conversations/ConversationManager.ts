import path from "node:path";
import type { Phase } from "@/types/conversation";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";
import { ensureDirectory, fileExists, readFile, writeJsonFile } from "@tenex/shared/fs";
import { FileSystemAdapter } from "./persistence";
import type { ConversationMetadata, ConversationState } from "./types";

export class ConversationManager {
  private conversations: Map<string, ConversationState> = new Map();
  private conversationsDir: string;
  private persistence: FileSystemAdapter;

  constructor(private projectPath: string) {
    this.conversationsDir = path.join(projectPath, ".tenex", "conversations");
    this.persistence = new FileSystemAdapter(projectPath);
  }

  async initialize(): Promise<void> {
    await ensureDirectory(this.conversationsDir);
    await this.persistence.initialize();

    // Load existing conversations
    await this.loadConversations();
  }

  async createConversation(event: NDKEvent): Promise<ConversationState> {
    const id = event.id;
    if (!id) {
      throw new Error("Event must have an ID to create a conversation");
    }
    const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled Conversation";

    const conversation: ConversationState = {
      id,
      title,
      phase: "chat", // All conversations start in chat phase
      history: [event],
      currentAgent: undefined,
      phaseStartedAt: Date.now(),
      metadata: {
        summary: event.content,
      },
    };

    this.conversations.set(id, conversation);
    logger.info(`Created new conversation: ${title}`, { id });

    // Save immediately after creation
    await this.persistence.save(conversation);

    return conversation;
  }

  getConversation(id: string): ConversationState | undefined {
    return this.conversations.get(id);
  }

  async updatePhase(id: string, phase: Phase, context?: string): Promise<void> {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      throw new Error(`Conversation ${id} not found`);
    }

    const previousPhase = conversation.phase;
    conversation.phase = phase;
    conversation.phaseStartedAt = Date.now();

    // Store phase transition context
    if (context) {
      conversation.metadata[`${previousPhase}_summary`] = context;
    }

    logger.info(`Conversation ${id} transitioned from ${previousPhase} to ${phase}`);

    // Save after phase update
    await this.persistence.save(conversation);
  }

  async addEvent(conversationId: string, event: NDKEvent): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.history.push(event);

    // Update the conversation summary to include the latest message
    // This ensures other parts of the system have access to updated context
    if (event.content) {
      const isUser = !event.tags.some((tag) => tag[0] === "llm-model");
      if (isUser) {
        // For user messages, update the summary to be more descriptive
        conversation.metadata.summary = event.content;
        conversation.metadata.last_user_message = event.content;
      }
    }

    // Save after adding event
    await this.persistence.save(conversation);
  }

  async updateCurrentAgent(conversationId: string, agentPubkey: string | undefined): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.currentAgent = agentPubkey;

    // Save after updating agent
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

  async compactHistory(id: string, targetPhase: Phase): Promise<string> {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      throw new Error(`Conversation ${id} not found`);
    }

    // Extract user requirements from conversation history
    const userMessages = conversation.history
      .filter((event) => !event.tags.some((tag) => tag[0] === "llm-model"))
      .map((event) => event.content)
      .join("\n");

    // Create a clear context based on target phase
    let context = "";

    if (targetPhase === "plan") {
      context = `User Request:\n${userMessages}\n\nThe user needs assistance with the above request. Create a detailed implementation plan.`;
    } else if (targetPhase === "execute") {
      context = `Previous Phase Summary:\n${conversation.metadata[`${conversation.phase}_summary`] || userMessages}\n\nProceed with implementation.`;
    } else {
      context = `Conversation History:\n${userMessages}\n\nMoving to ${targetPhase} phase.`;
    }

    return context;
  }

  getAllConversations(): ConversationState[] {
    return Array.from(this.conversations.values());
  }

  getConversationByEvent(eventId: string): ConversationState | undefined {
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

      logger.info(`Loaded ${loadedCount} conversations from disk`);
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

  async searchConversations(query: string): Promise<ConversationState[]> {
    const metadata = await this.persistence.search({ title: query });
    const conversations: ConversationState[] = [];

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
}
