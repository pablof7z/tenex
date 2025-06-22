import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { ConversationManager } from "../ConversationManager";
import { FileSystemAdapter } from "../persistence";
import type { Conversation } from "../types";
import { createConversationEvent, createReplyEvent } from "@/test-utils/mocks/events";
import { createMockFileSystemAdapter } from "@/test-utils/mocks/filesystem";
import { logger } from "@/utils/logger";

// Mock dependencies
jest.mock("../persistence");
jest.mock("@/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("ConversationManager", () => {
  let manager: ConversationManager;
  let mockPersistence: ReturnType<typeof createMockFileSystemAdapter>;
  const testProjectPath = "/test/project";

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockPersistence = createMockFileSystemAdapter();
    (FileSystemAdapter as jest.MockedClass<typeof FileSystemAdapter>).mockImplementation(
      () => mockPersistence as any
    );

    manager = new ConversationManager(testProjectPath);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("initialize", () => {
    it("should initialize persistence and load conversations", async () => {
      const existingConversation: Conversation = {
        id: "conv-1",
        title: "Existing Conversation",
        phase: "plan",
        history: [createConversationEvent("conv-1")],
        currentAgent: "agent-pubkey",
        phaseStartedAt: Date.now(),
        metadata: {},
      };

      mockPersistence.addConversation(existingConversation);

      await manager.initialize();

      expect(mockPersistence.initialize).toHaveBeenCalled();
      expect(mockPersistence.list).toHaveBeenCalled();
      expect(mockPersistence.loadCallCount).toBe(1);

      const loaded = manager.getConversation("conv-1");
      expect(loaded).toBeDefined();
      expect(loaded?.title).toBe("Existing Conversation");
    });

    it("should set up autosave interval", async () => {
      await manager.initialize();

      expect(jest.getTimerCount()).toBe(1);

      // Fast-forward 30 seconds
      jest.advanceTimersByTime(30000);

      expect(mockPersistence.saveCallCount).toBeGreaterThan(0);
    });

    it("should handle persistence initialization errors", async () => {
      mockPersistence.initialize = jest.fn().mockRejectedValue(new Error("Init failed"));

      await expect(manager.initialize()).rejects.toThrow("Init failed");
    });
  });

  describe("createConversation", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it("should create a new conversation from event", async () => {
      const event = createConversationEvent("conv-123", "Hello world", "Test Conversation");

      const conversation = await manager.createConversation(event);

      expect(conversation.id).toBe("conv-123");
      expect(conversation.title).toBe("Test Conversation");
      expect(conversation.phase).toBe("chat");
      expect(conversation.history).toHaveLength(1);
      expect(conversation.history[0]).toBe(event);
      expect(conversation.currentAgent).toBeUndefined();
      expect(conversation.metadata.summary).toBe("Hello world");

      // Verify saved to persistence
      expect(mockPersistence.saveCallCount).toBe(1);
    });

    it("should handle events without title tag", async () => {
      const event = createConversationEvent("conv-123", "Hello");
      event.tags = []; // Remove all tags

      const conversation = await manager.createConversation(event);

      expect(conversation.title).toBe("Untitled Conversation");
    });

    it("should throw if event has no ID", async () => {
      const event = createConversationEvent();
      event.id = undefined;

      await expect(manager.createConversation(event)).rejects.toThrow(
        "Event must have an ID"
      );
    });

    it("should store conversation in memory", async () => {
      const event = createConversationEvent("conv-123");

      await manager.createConversation(event);

      const retrieved = manager.getConversation("conv-123");
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe("conv-123");
    });
  });

  describe("updatePhase", () => {
    let conversation: Conversation;

    beforeEach(async () => {
      await manager.initialize();
      const event = createConversationEvent("conv-123");
      conversation = await manager.createConversation(event);
    });

    it("should update conversation phase", async () => {
      const originalPhase = conversation.phase;
      const originalStartTime = conversation.phaseStartedAt;

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await manager.updatePhase("conv-123", "plan");

      const updated = manager.getConversation("conv-123");
      expect(updated?.phase).toBe("plan");
      expect(updated?.phaseStartedAt).toBeGreaterThan(originalStartTime);
    });

    it("should store phase transition context", async () => {
      await manager.updatePhase("conv-123", "plan", "Chat phase completed successfully");

      const updated = manager.getConversation("conv-123");
      expect(updated?.metadata.chat_summary).toBe("Chat phase completed successfully");
    });

    it("should throw for non-existent conversation", async () => {
      await expect(
        manager.updatePhase("non-existent", "plan")
      ).rejects.toThrow("Conversation non-existent not found");
    });
  });

  describe("addEvent", () => {
    beforeEach(async () => {
      await manager.initialize();
      const event = createConversationEvent("conv-123");
      await manager.createConversation(event);
    });

    it("should add event to conversation history", async () => {
      const reply = createReplyEvent("conv-123", "This is a reply");

      await manager.addEvent("conv-123", reply);

      const conversation = manager.getConversation("conv-123");
      expect(conversation?.history).toHaveLength(2);
      expect(conversation?.history[1]).toBe(reply);
    });

    it("should throw for non-existent conversation", async () => {
      const reply = createReplyEvent("non-existent");

      await expect(
        manager.addEvent("non-existent", reply)
      ).rejects.toThrow("Conversation non-existent not found");
    });
  });

  describe("updateCurrentAgent", () => {
    beforeEach(async () => {
      await manager.initialize();
      const event = createConversationEvent("conv-123");
      await manager.createConversation(event);
    });

    it("should update current agent", async () => {
      await manager.updateCurrentAgent("conv-123", "agent-pubkey");

      const conversation = manager.getConversation("conv-123");
      expect(conversation?.currentAgent).toBe("agent-pubkey");
    });

    it("should clear current agent when undefined", async () => {
      await manager.updateCurrentAgent("conv-123", "agent-pubkey");
      await manager.updateCurrentAgent("conv-123", undefined);

      const conversation = manager.getConversation("conv-123");
      expect(conversation?.currentAgent).toBeUndefined();
    });
  });

  describe("updateMetadata", () => {
    beforeEach(async () => {
      await manager.initialize();
      const event = createConversationEvent("conv-123");
      await manager.createConversation(event);
    });

    it("should update conversation metadata", async () => {
      await manager.updateMetadata("conv-123", {
        plan: "Build a web app",
        tools_used: ["shell", "file"],
      });

      const conversation = manager.getConversation("conv-123");
      expect(conversation?.metadata.plan).toBe("Build a web app");
      expect(conversation?.metadata.tools_used).toEqual(["shell", "file"]);
      expect(conversation?.metadata.summary).toBe("Test conversation"); // Original preserved
    });

    it("should merge with existing metadata", async () => {
      await manager.updateMetadata("conv-123", { key1: "value1" });
      await manager.updateMetadata("conv-123", { key2: "value2" });

      const conversation = manager.getConversation("conv-123");
      expect(conversation?.metadata.key1).toBe("value1");
      expect(conversation?.metadata.key2).toBe("value2");
    });
  });

  describe("getPhaseHistory", () => {
    beforeEach(async () => {
      await manager.initialize();
      const event = createConversationEvent("conv-123");
      await manager.createConversation(event);
    });

    it("should return conversation history", async () => {
      const reply1 = createReplyEvent("conv-123", "Reply 1");
      const reply2 = createReplyEvent("conv-123", "Reply 2");

      await manager.addEvent("conv-123", reply1);
      await manager.addEvent("conv-123", reply2);

      const history = manager.getPhaseHistory("conv-123");

      expect(history).toHaveLength(3);
      expect(history[1]).toBe(reply1);
      expect(history[2]).toBe(reply2);
    });

    it("should return empty array for non-existent conversation", () => {
      const history = manager.getPhaseHistory("non-existent");
      expect(history).toEqual([]);
    });
  });

  describe("persistence operations", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it("should save specific conversation", async () => {
      const event = createConversationEvent("conv-123");
      const conversation = await manager.createConversation(event);

      mockPersistence.saveCallCount = 0; // Reset counter

      await manager.saveConversation("conv-123");

      expect(mockPersistence.saveCallCount).toBe(1);
      expect(mockPersistence.save).toHaveBeenCalledWith(conversation);
    });

    it("should archive conversation", async () => {
      const event = createConversationEvent("conv-123");
      await manager.createConversation(event);

      await manager.archiveConversation("conv-123");

      expect(mockPersistence.archive).toHaveBeenCalledWith("conv-123");
      expect(manager.getConversation("conv-123")).toBeUndefined();
    });

    it("should search conversations", async () => {
      const searchResults: Conversation[] = [
        {
          id: "conv-1",
          title: "Express Setup",
          phase: "chat",
          history: [],
          currentAgent: undefined,
          phaseStartedAt: Date.now(),
          metadata: {},
        },
      ];

      mockPersistence.search = jest.fn().mockResolvedValue([
        { id: "conv-1", title: "Express Setup" },
      ]);
      mockPersistence.load = jest.fn().mockResolvedValue(searchResults[0]);

      const results = await manager.searchConversations("Express");

      expect(mockPersistence.search).toHaveBeenCalledWith({ title: "Express" });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Express Setup");
    });

    it("should handle autosave errors gracefully", async () => {
      mockPersistence.save = jest.fn().mockRejectedValue(new Error("Save failed"));

      // Trigger autosave
      jest.advanceTimersByTime(30000);

      // Wait for autosave to complete
      await Promise.resolve();

      expect(logger.error).toHaveBeenCalledWith(
        "Autosave failed",
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe("cleanup", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it("should save all conversations before cleanup", async () => {
      const event1 = createConversationEvent("conv-1");
      const event2 = createConversationEvent("conv-2");

      await manager.createConversation(event1);
      await manager.createConversation(event2);

      mockPersistence.saveCallCount = 0; // Reset

      await manager.cleanup();

      expect(mockPersistence.saveCallCount).toBe(2);
    });

    it("should clear autosave interval", async () => {
      await manager.cleanup();

      const timerCount = jest.getTimerCount();
      expect(timerCount).toBe(0);
    });
  });

  describe("getAllConversations", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it("should return all active conversations", async () => {
      await manager.createConversation(createConversationEvent("conv-1"));
      await manager.createConversation(createConversationEvent("conv-2"));
      await manager.createConversation(createConversationEvent("conv-3"));

      const all = manager.getAllConversations();

      expect(all).toHaveLength(3);
      expect(all.map(c => c.id)).toContain("conv-1");
      expect(all.map(c => c.id)).toContain("conv-2");
      expect(all.map(c => c.id)).toContain("conv-3");
    });
  });

  describe("getConversationByEvent", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it("should find conversation containing specific event", async () => {
      const conv = await manager.createConversation(createConversationEvent("conv-1"));
      const reply = createReplyEvent("conv-1");
      await manager.addEvent("conv-1", reply);

      const found = manager.getConversationByEvent(reply.id!);

      expect(found).toBeDefined();
      expect(found?.id).toBe("conv-1");
    });

    it("should return undefined for non-existent event", () => {
      const found = manager.getConversationByEvent("non-existent-event");
      expect(found).toBeUndefined();
    });
  });
});