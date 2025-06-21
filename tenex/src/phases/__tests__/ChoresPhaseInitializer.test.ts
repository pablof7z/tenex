import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChoresPhaseInitializer } from "../ChoresPhaseInitializer";
import type { ConversationState } from "@/conversations/types";
import type { Agent } from "@/types/agent";
import { AnalyzeTask } from "@/tasks/analyzeTask";
import { getProjectContext } from "@/runtime";
import { getNDK } from "@/nostr/ndkClient";
import type { ProjectInventory } from "@tenex/types/inventory";

vi.mock("@/tasks/analyzeTask");
vi.mock("@/runtime");
vi.mock("@/nostr/ndkClient");
vi.mock("@tenex/shared", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("ChoresPhaseInitializer", () => {
  let initializer: ChoresPhaseInitializer;
  let mockConversation: ConversationState;
  let mockAgents: Agent[];
  let mockProjectContext: any;
  let mockNDK: any;

  beforeEach(() => {
    initializer = new ChoresPhaseInitializer();
    
    mockProjectContext = {
      projectPath: "/test/project",
      projectSigner: {
        pubkey: "project123",
        sign: vi.fn(),
      },
      title: "Test Project",
    };

    mockNDK = {
      connect: vi.fn(),
    };

    vi.mocked(getProjectContext).mockReturnValue(mockProjectContext);
    vi.mocked(getNDK).mockReturnValue(mockNDK);

    mockConversation = {
      id: "conv123",
      title: "Test Conversation",
      phase: "review",
      history: [
        {
          id: "event1",
          content: "Created file src/index.ts",
          tags: [],
          created_at: Date.now() / 1000,
        },
        {
          id: "event2",
          content: "Modified file src/utils.ts",
          tags: [["llm-model", "claude"]],
          created_at: Date.now() / 1000,
        },
      ] as any,
      currentAgent: undefined,
      phaseStartedAt: Date.now(),
      metadata: {
        execute_files: ["src/components/Button.tsx"],
      },
    };

    mockAgents = [
      {
        name: "Test Agent",
        pubkey: "agent123",
        role: "Developer",
        expertise: "TypeScript",
        llmConfig: "default",
        tools: [],
      } as any,
    ];

    vi.clearAllMocks();
  });

  describe("initialize", () => {
    it("should successfully update inventory when files are changed", async () => {
      const mockInventory: ProjectInventory = {
        projectPath: "/test/project",
        generatedAt: Date.now(),
        version: "1.0.0",
        projectDescription: "Test project",
        technologies: ["Node.js", "TypeScript"],
        files: [],
        directories: [],
        stats: {
          totalFiles: 10,
          totalDirectories: 5,
          totalSize: 10000,
          fileTypes: { ".ts": 5, ".tsx": 5 },
        },
      };

      const mockAnalyzeTask = {
        execute: vi.fn().mockResolvedValue(mockInventory),
      };

      vi.mocked(AnalyzeTask).mockImplementation(() => mockAnalyzeTask as any);

      const result = await initializer.initialize(mockConversation, mockAgents);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Updated inventory for 3 changed files");
      expect(result.metadata).toEqual({
        phase: "chores",
        inventoryUpdated: true,
        filesUpdated: 3,
        inventoryStats: mockInventory.stats,
      });

      expect(AnalyzeTask).toHaveBeenCalledWith({
        projectPath: "/test/project",
        conversationId: "conv123",
        signer: mockProjectContext.projectSigner,
        targetFiles: ["src/components/Button.tsx", "src/index.ts", "src/utils.ts"],
        skipClaudeCode: false,
      });
    });

    it("should skip inventory update when no files are changed", async () => {
      mockConversation.history = [];
      mockConversation.metadata = {};

      const result = await initializer.initialize(mockConversation, mockAgents);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Chores phase complete. No inventory update needed.");
      expect(result.metadata).toEqual({
        phase: "chores",
        inventoryUpdated: false,
        reason: "No file changes detected",
      });

      expect(AnalyzeTask).not.toHaveBeenCalled();
    });

    it("should handle inventory update failure gracefully", async () => {
      const mockAnalyzeTask = {
        execute: vi.fn().mockRejectedValue(new Error("Failed to analyze")),
      };

      vi.mocked(AnalyzeTask).mockImplementation(() => mockAnalyzeTask as any);

      const result = await initializer.initialize(mockConversation, mockAgents);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Chores phase complete. Inventory update failed but continuing.");
      expect(result.metadata).toEqual({
        phase: "chores",
        inventoryUpdated: false,
        error: "Failed to analyze",
      });
    });

    it("should extract files from various content patterns", async () => {
      mockConversation.history = [
        {
          id: "event1",
          content: "I created file `src/new-feature.ts` with the implementation",
          tags: [],
          created_at: Date.now() / 1000,
        },
        {
          id: "event2",
          content: "Updated file: components/Header.tsx",
          tags: [],
          created_at: Date.now() / 1000,
        },
        {
          id: "event3",
          content: "File: src/config.json has been modified",
          tags: [],
          created_at: Date.now() / 1000,
        },
        {
          id: "event4",
          content: "```typescript\n// src/types.ts\ninterface User {",
          tags: [],
          created_at: Date.now() / 1000,
        },
      ] as any;

      const mockInventory: ProjectInventory = {
        projectPath: "/test/project",
        generatedAt: Date.now(),
        version: "1.0.0",
        projectDescription: "Test",
        technologies: [],
        files: [],
        directories: [],
        stats: {
          totalFiles: 0,
          totalDirectories: 0,
          totalSize: 0,
          fileTypes: {},
        },
      };

      const mockAnalyzeTask = {
        execute: vi.fn().mockResolvedValue(mockInventory),
      };

      vi.mocked(AnalyzeTask).mockImplementation(() => mockAnalyzeTask as any);

      await initializer.initialize(mockConversation, mockAgents);

      const analyzeTaskCall = vi.mocked(AnalyzeTask).mock.calls[0][0];
      expect(analyzeTaskCall.targetFiles).toContain("src/new-feature.ts");
      expect(analyzeTaskCall.targetFiles).toContain("components/Header.tsx");
      expect(analyzeTaskCall.targetFiles).toContain("src/config.json");
      expect(analyzeTaskCall.targetFiles).toContain("src/types.ts");
    });

    it("should handle initialization errors", async () => {
      vi.mocked(getProjectContext).mockImplementation(() => {
        throw new Error("Project context error");
      });

      const result = await initializer.initialize(mockConversation, mockAgents);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Chores phase initialization failed");
    });

    it("should deduplicate file paths", async () => {
      mockConversation.history = [
        {
          id: "event1",
          content: "Created file src/index.ts",
          tags: [],
          created_at: Date.now() / 1000,
        },
        {
          id: "event2",
          content: "Modified file src/index.ts again",
          tags: [],
          created_at: Date.now() / 1000,
        },
      ] as any;
      mockConversation.metadata = {
        execute_files: ["src/index.ts"],
      };

      const mockInventory: ProjectInventory = {
        projectPath: "/test/project",
        generatedAt: Date.now(),
        version: "1.0.0",
        projectDescription: "Test",
        technologies: [],
        files: [],
        directories: [],
        stats: {
          totalFiles: 1,
          totalDirectories: 0,
          totalSize: 100,
          fileTypes: { ".ts": 1 },
        },
      };

      const mockAnalyzeTask = {
        execute: vi.fn().mockResolvedValue(mockInventory),
      };

      vi.mocked(AnalyzeTask).mockImplementation(() => mockAnalyzeTask as any);

      const result = await initializer.initialize(mockConversation, mockAgents);

      expect(result.message).toContain("Updated inventory for 1 changed files");
      
      const analyzeTaskCall = vi.mocked(AnalyzeTask).mock.calls[0][0];
      expect(analyzeTaskCall.targetFiles).toHaveLength(1);
      expect(analyzeTaskCall.targetFiles).toContain("src/index.ts");
    });

    it("should filter out non-file paths", async () => {
      mockConversation.history = [
        {
          id: "event1",
          content: "Created file https://example.com/file.ts",
          tags: [],
          created_at: Date.now() / 1000,
        },
        {
          id: "event2",
          content: "Modified file user@example.com",
          tags: [],
          created_at: Date.now() / 1000,
        },
        {
          id: "event3",
          content: "Created file src/valid.ts",
          tags: [],
          created_at: Date.now() / 1000,
        },
      ] as any;

      const mockInventory: ProjectInventory = {
        projectPath: "/test/project",
        generatedAt: Date.now(),
        version: "1.0.0",
        projectDescription: "Test",
        technologies: [],
        files: [],
        directories: [],
        stats: {
          totalFiles: 1,
          totalDirectories: 0,
          totalSize: 100,
          fileTypes: { ".ts": 1 },
        },
      };

      const mockAnalyzeTask = {
        execute: vi.fn().mockResolvedValue(mockInventory),
      };

      vi.mocked(AnalyzeTask).mockImplementation(() => mockAnalyzeTask as any);

      await initializer.initialize(mockConversation, mockAgents);

      const analyzeTaskCall = vi.mocked(AnalyzeTask).mock.calls[0][0];
      expect(analyzeTaskCall.targetFiles).toHaveLength(1);
      expect(analyzeTaskCall.targetFiles).toContain("src/valid.ts");
    });
  });
});