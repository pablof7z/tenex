import { describe, it, expect, beforeEach, vi } from "vitest";
import { AnalyzeTask } from "../analyzeTask";
import { InventoryService } from "@/services/InventoryService";
import { ClaudeCodeExecutor } from "@/tools/ClaudeCodeExecutor";
import type { ProjectInventory } from "@tenex/types/inventory";
import type { NDKSigner } from "@nostr-dev-kit/ndk";

vi.mock("@/services/InventoryService");
vi.mock("@/tools/ClaudeCodeExecutor");
vi.mock("@tenex/shared", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("AnalyzeTask", () => {
  let mockSigner: NDKSigner;
  let mockInventoryService: any;
  let mockClaudeCodeExecutor: any;

  const mockBasicInventory: ProjectInventory = {
    projectPath: "/test/project",
    generatedAt: Date.now(),
    version: "1.0.0",
    projectDescription: "Test project",
    technologies: ["Node.js", "TypeScript"],
    files: [
      {
        path: "src/index.ts",
        type: ".ts",
        description: ".ts file",
        size: 1024,
        lastModified: Date.now(),
      },
    ],
    directories: [],
    stats: {
      totalFiles: 1,
      totalDirectories: 0,
      totalSize: 1024,
      fileTypes: { ".ts": 1 },
    },
  };

  beforeEach(() => {
    mockSigner = {
      pubkey: "test123",
      sign: vi.fn(),
    } as any;

    mockInventoryService = {
      generateInventory: vi.fn().mockResolvedValue(mockBasicInventory),
      updateInventory: vi.fn().mockResolvedValue({
        added: [],
        modified: ["src/index.ts"],
        removed: [],
        inventory: mockBasicInventory,
      }),
      saveInventory: vi.fn().mockResolvedValue(undefined),
    };

    mockClaudeCodeExecutor = {
      execute: vi.fn().mockResolvedValue("task123"),
    };

    vi.mocked(InventoryService).mockImplementation(() => mockInventoryService);
    vi.mocked(ClaudeCodeExecutor).mockImplementation(() => mockClaudeCodeExecutor);

    vi.clearAllMocks();
  });

  describe("execute", () => {
    it("should generate full inventory when no target files", async () => {
      const task = new AnalyzeTask({
        projectPath: "/test/project",
        conversationId: "conv123",
        signer: mockSigner,
      });

      const result = await task.execute();

      expect(result).toEqual(mockBasicInventory);
      expect(mockInventoryService.generateInventory).toHaveBeenCalled();
      expect(mockInventoryService.saveInventory).toHaveBeenCalledWith(mockBasicInventory);
      expect(ClaudeCodeExecutor).toHaveBeenCalledWith({
        conversationId: "conv123",
        signer: mockSigner,
      });
    });

    it("should update inventory for specific files", async () => {
      const task = new AnalyzeTask({
        projectPath: "/test/project",
        conversationId: "conv123",
        signer: mockSigner,
        targetFiles: ["src/index.ts", "src/utils.ts"],
      });

      const result = await task.execute();

      expect(result).toEqual(mockBasicInventory);
      expect(mockInventoryService.updateInventory).toHaveBeenCalledWith([
        "src/index.ts",
        "src/utils.ts",
      ]);
      expect(mockInventoryService.generateInventory).not.toHaveBeenCalled();
    });

    it("should skip Claude Code when skipClaudeCode is true", async () => {
      const task = new AnalyzeTask({
        projectPath: "/test/project",
        conversationId: "conv123",
        signer: mockSigner,
        skipClaudeCode: true,
      });

      const result = await task.execute();

      expect(result).toEqual(mockBasicInventory);
      expect(ClaudeCodeExecutor).not.toHaveBeenCalled();
      expect(mockClaudeCodeExecutor.execute).not.toHaveBeenCalled();
    });

    it("should enhance inventory with Claude Code", async () => {
      const task = new AnalyzeTask({
        projectPath: "/test/project",
        conversationId: "conv123",
        signer: mockSigner,
      });

      await task.execute();

      expect(mockClaudeCodeExecutor.execute).toHaveBeenCalledWith({
        prompt: expect.stringContaining("# Project Inventory Analysis"),
        conversationContext: "",
        requirements: expect.stringContaining("Analyze the project structure"),
        phase: "chores",
      });
    });

    it("should handle Claude Code failure gracefully", async () => {
      mockClaudeCodeExecutor.execute.mockRejectedValue(new Error("Claude Code failed"));

      const task = new AnalyzeTask({
        projectPath: "/test/project",
        conversationId: "conv123",
        signer: mockSigner,
      });

      const result = await task.execute();

      expect(result).toEqual(mockBasicInventory);
      expect(mockInventoryService.saveInventory).toHaveBeenCalled();
    });

    it("should enhance only changed files when updating", async () => {
      mockInventoryService.updateInventory.mockResolvedValue({
        added: ["src/new.ts"],
        modified: ["src/index.ts"],
        removed: [],
        inventory: mockBasicInventory,
      });

      const task = new AnalyzeTask({
        projectPath: "/test/project",
        conversationId: "conv123",
        signer: mockSigner,
        targetFiles: ["src/index.ts", "src/new.ts", "src/deleted.ts"],
      });

      await task.execute();

      expect(mockClaudeCodeExecutor.execute).toHaveBeenCalledWith({
        prompt: expect.stringContaining("# Partial Project Inventory Update"),
        conversationContext: "",
        requirements: expect.stringContaining("Analyze these 2 files"),
        phase: "chores",
      });
    });

    it("should handle task execution errors", async () => {
      mockInventoryService.generateInventory.mockRejectedValue(new Error("Service error"));

      const task = new AnalyzeTask({
        projectPath: "/test/project",
        conversationId: "conv123",
        signer: mockSigner,
      });

      await expect(task.execute()).rejects.toThrow("Service error");
    });

    it("should build proper prompt with file structure", async () => {
      const inventoryWithManyFiles: ProjectInventory = {
        ...mockBasicInventory,
        files: [
          {
            path: "src/index.ts",
            type: ".ts",
            description: "Main entry",
            size: 1024,
            lastModified: Date.now(),
          },
          {
            path: "src/utils/helpers.ts",
            type: ".ts",
            description: "Helper functions",
            size: 512,
            lastModified: Date.now(),
          },
          {
            path: "test/index.test.ts",
            type: ".ts",
            description: "Tests",
            size: 2048,
            lastModified: Date.now(),
          },
        ],
        directories: [
          {
            path: "src",
            description: "Source directory",
            fileCount: 2,
            subdirectories: ["utils"],
          },
          {
            path: "test",
            description: "Test directory",
            fileCount: 1,
            subdirectories: [],
          },
        ],
      };

      mockInventoryService.generateInventory.mockResolvedValue(inventoryWithManyFiles);

      const task = new AnalyzeTask({
        projectPath: "/test/project",
        conversationId: "conv123",
        signer: mockSigner,
      });

      await task.execute();

      const executeCall = mockClaudeCodeExecutor.execute.mock.calls[0][0];
      expect(executeCall.prompt).toContain("src/");
      expect(executeCall.prompt).toContain("test/");
      expect(executeCall.prompt).toContain("index.ts (.ts)");
      expect(executeCall.prompt).toContain("helpers.ts (.ts)");
    });

    it("should format file sizes correctly in prompts", async () => {
      const inventoryWithFiles: ProjectInventory = {
        ...mockBasicInventory,
        files: [
          {
            path: "small.txt",
            type: ".txt",
            description: "Small file",
            size: 512, // 512B
            lastModified: Date.now(),
          },
          {
            path: "medium.js",
            type: ".js",
            description: "Medium file",
            size: 10240, // 10KB
            lastModified: Date.now(),
          },
          {
            path: "large.bin",
            type: ".bin",
            description: "Large file",
            size: 5242880, // 5MB
            lastModified: Date.now(),
          },
        ],
      };

      mockInventoryService.updateInventory.mockResolvedValue({
        added: ["small.txt", "medium.js", "large.bin"],
        modified: [],
        removed: [],
        inventory: inventoryWithFiles,
      });

      const task = new AnalyzeTask({
        projectPath: "/test/project",
        conversationId: "conv123",
        signer: mockSigner,
        targetFiles: ["small.txt", "medium.js", "large.bin"],
      });

      await task.execute();

      const executeCall = mockClaudeCodeExecutor.execute.mock.calls[0][0];
      expect(executeCall.prompt).toContain("small.txt (.txt, 512B)");
      expect(executeCall.prompt).toContain("medium.js (.js, 10.0KB)");
      expect(executeCall.prompt).toContain("large.bin (.bin, 5.0MB)");
    });
  });

  describe("edge cases", () => {
    it("should handle empty inventory", async () => {
      const emptyInventory: ProjectInventory = {
        ...mockBasicInventory,
        files: [],
        directories: [],
        stats: {
          totalFiles: 0,
          totalDirectories: 0,
          totalSize: 0,
          fileTypes: {},
        },
      };

      mockInventoryService.generateInventory.mockResolvedValue(emptyInventory);

      const task = new AnalyzeTask({
        projectPath: "/test/project",
        conversationId: "conv123",
        signer: mockSigner,
      });

      const result = await task.execute();

      expect(result).toEqual(emptyInventory);
      expect(mockInventoryService.saveInventory).toHaveBeenCalledWith(emptyInventory);
    });

    it("should handle inventory with no changes during update", async () => {
      mockInventoryService.updateInventory.mockResolvedValue({
        added: [],
        modified: [],
        removed: [],
        inventory: mockBasicInventory,
      });

      const task = new AnalyzeTask({
        projectPath: "/test/project",
        conversationId: "conv123",
        signer: mockSigner,
        targetFiles: ["src/unchanged.ts"],
      });

      const result = await task.execute();

      expect(result).toEqual(mockBasicInventory);
      expect(mockClaudeCodeExecutor.execute).not.toHaveBeenCalled();
    });
  });
});