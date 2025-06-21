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
  private autosaveInterval: NodeJS.Timeout | null = null;

  constructor(private projectPath: string) {
    this.conversationsDir = path.join(projectPath, ".tenex", "conversations");
    this.persistence = new FileSystemAdapter(projectPath);
  }

  async initialize(): Promise<void> {
    await ensureDirectory(this.conversationsDir);
    await this.persistence.initialize();

    // Load existing conversations
    await this.loadConversations();

    // Setup autosave every 30 seconds
    this.autosaveInterval = setInterval(() => {
      this.saveAllConversations().catch((error) => logger.error("Autosave failed", { error }));
    }, 30000);
  }

  async createConversation(event: NDKEvent): Promise<ConversationState> {
    const id = event.id!;
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
  }

  async addEvent(conversationId: string, event: NDKEvent): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.history.push(event);
  }

  async updateCurrentAgent(conversationId: string, agentPubkey: string | undefined): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.currentAgent = agentPubkey;
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

    // For now, return a simple summary
    // This will be enhanced with LLM-based summarization
    const summary = `Conversation "${conversation.title}" moving from ${conversation.phase} to ${targetPhase}.
Current understanding: ${conversation.metadata.summary || "No summary available"}`;

    return summary;
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

    // Clear autosave interval
    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval);
      this.autosaveInterval = null;
    }
  }
}
