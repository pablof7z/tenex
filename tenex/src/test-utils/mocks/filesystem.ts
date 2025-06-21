import type { FileSystemAdapter } from "@/conversations/persistence/FileSystemAdapter";
import type { ConversationMetadata } from "@/conversations/persistence/types";
import type { ConversationState } from "@/conversations/types";

export class MockFileSystemAdapter implements Partial<FileSystemAdapter> {
  private conversations: Map<string, ConversationState> = new Map();
  private metadata: Map<string, ConversationMetadata> = new Map();
  public saveCallCount = 0;
  public loadCallCount = 0;

  async initialize(): Promise<void> {
    // Mock implementation
    return Promise.resolve();
  }

  async save(conversation: ConversationState): Promise<void> {
    this.saveCallCount++;
    this.conversations.set(conversation.id, conversation);
    this.metadata.set(conversation.id, {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.history[0]?.created_at || Date.now() / 1000,
      updatedAt: Date.now() / 1000,
      phase: conversation.phase,
      eventCount: conversation.history.length,
      agentCount: new Set(conversation.history.map((e) => e.pubkey)).size,
      archived: false,
    });
  }

  async load(conversationId: string): Promise<ConversationState | null> {
    this.loadCallCount++;
    return this.conversations.get(conversationId) || null;
  }

  async list(): Promise<ConversationMetadata[]> {
    return Array.from(this.metadata.values());
  }

  async archive(conversationId: string): Promise<void> {
    const meta = this.metadata.get(conversationId);
    if (meta) {
      meta.archived = true;
    }
  }

  async search(criteria: { title?: string; phase?: string }): Promise<ConversationMetadata[]> {
    const results: ConversationMetadata[] = [];

    for (const meta of this.metadata.values()) {
      if (criteria.title && !meta.title.toLowerCase().includes(criteria.title.toLowerCase())) {
        continue;
      }
      if (criteria.phase && meta.phase !== criteria.phase) {
        continue;
      }
      results.push(meta);
    }

    return results;
  }

  // Test helper methods
  addConversation(conversation: ConversationState): void {
    this.conversations.set(conversation.id, conversation);
    this.metadata.set(conversation.id, {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.history[0]?.created_at || Date.now() / 1000,
      updatedAt: Date.now() / 1000,
      phase: conversation.phase,
      eventCount: conversation.history.length,
      agentCount: new Set(conversation.history.map((e) => e.pubkey)).size,
      archived: false,
    });
  }

  clearAll(): void {
    this.conversations.clear();
    this.metadata.clear();
    this.saveCallCount = 0;
    this.loadCallCount = 0;
  }

  getConversation(id: string): ConversationState | undefined {
    return this.conversations.get(id);
  }
}

export function createMockFileSystemAdapter(): MockFileSystemAdapter {
  return new MockFileSystemAdapter();
}
