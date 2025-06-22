import { describe, it, expect, beforeEach, mock } from "bun:test";
import { ToolExecutionManager } from "../ToolExecutionManager";
import { ToolDetector } from "../ToolDetector";
import { ShellExecutor } from "../executors/ShellExecutor";
import { FileExecutor } from "../executors/FileExecutor";
import type { ToolExecutionContext, ToolInvocation, ToolExecutionResult } from "@/types/tool";

// Mock executors
jest.mock("../executors/ShellExecutor");
jest.mock("../executors/FileExecutor");
jest.mock("../ToolDetector");

describe("ToolExecutionManager", () => {
  let manager: ToolExecutionManager;
  let mockDetector: jest.Mocked<ToolDetector>;
  let mockShellExecutor: jest.Mocked<ShellExecutor>;
  let mockFileExecutor: jest.Mocked<FileExecutor>;

  const testContext: ToolExecutionContext = {
    projectPath: "/test/project",
    conversationId: "conv-123",
    agentName: "TestAgent",
    phase: "execute",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked instances
    mockDetector = {
      detectTools: jest.fn().mockReturnValue([]),
    } as any;

    mockShellExecutor = {
      execute: jest.fn().mockResolvedValue({
        success: true,
        output: "Command output",
      }),
    } as any;

    mockFileExecutor = {
      execute: jest.fn().mockResolvedValue({
        success: true,
        output: "File content",
      }),
    } as any;

    // Mock constructors
    (ToolDetector as jest.MockedClass<typeof ToolDetector>).mockImplementation(
      () => mockDetector
    );
    (ShellExecutor as jest.MockedClass<typeof ShellExecutor>).mockImplementation(
      () => mockShellExecutor
    );
    (FileExecutor as jest.MockedClass<typeof FileExecutor>).mockImplementation(
      () => mockFileExecutor
    );

    manager = new ToolExecutionManager();
  });

  describe("processResponse", () => {
    it("should process response with no tools", async () => {
      const response = "This is a simple response without tools.";
      mockDetector.detectTools.mockReturnValue([]);

      const result = await manager.processResponse(response, testContext);

      expect(result.cleanedResponse).toBe(response);
      expect(result.toolResults).toEqual([]);
      expect(result.enhancedResponse).toBe(response);
      expect(mockDetector.detectTools).toHaveBeenCalledWith(response);
    });

    it("should execute shell commands", async () => {
      const response = "Let me check the Node version.\n<execute>node --version</execute>";
      const toolInvocation: ToolInvocation = {
        toolName: "shell",
        action: "execute",
        parameters: { command: "node --version" },
        rawMatch: "<execute>node --version</execute>",
      };

      mockDetector.detectTools.mockReturnValue([toolInvocation]);
      mockShellExecutor.execute.mockResolvedValue({
        success: true,
        output: "v18.17.0",
      });

      const result = await manager.processResponse(response, testContext);

      expect(result.cleanedResponse).toBe("Let me check the Node version.\n");
      expect(result.toolResults).toHaveLength(1);
      expect(result.toolResults[0]).toEqual({
        toolName: "shell",
        success: true,
        output: "v18.17.0",
        duration: expect.any(Number),
      });
      expect(result.enhancedResponse).toContain("Let me check the Node version.");
      expect(result.enhancedResponse).toContain("```\nv18.17.0\n```");
    });

    it("should execute file operations", async () => {
      const response = `<read>package.json</read>`;
      const toolInvocation: ToolInvocation = {
        toolName: "file",
        action: "read",
        parameters: { path: "package.json" },
        rawMatch: "<read>package.json</read>",
      };

      mockDetector.detectTools.mockReturnValue([toolInvocation]);
      mockFileExecutor.execute.mockResolvedValue({
        success: true,
        output: '{"name": "test-project", "version": "1.0.0"}',
      });

      const result = await manager.processResponse(response, testContext);

      expect(mockFileExecutor.execute).toHaveBeenCalledWith("read", {
        path: "package.json",
      });
      expect(result.toolResults[0].output).toContain("test-project");
    });

    it("should handle multiple tool executions", async () => {
      const response = `<execute>pwd</execute>
<read>README.md</read>
<execute>ls -la</execute>`;

      const tools: ToolInvocation[] = [
        {
          toolName: "shell",
          action: "execute",
          parameters: { command: "pwd" },
          rawMatch: "<execute>pwd</execute>",
        },
        {
          toolName: "file",
          action: "read",
          parameters: { path: "README.md" },
          rawMatch: "<read>README.md</read>",
        },
        {
          toolName: "shell",
          action: "execute",
          parameters: { command: "ls -la" },
          rawMatch: "<execute>ls -la</execute>",
        },
      ];

      mockDetector.detectTools.mockReturnValue(tools);
      mockShellExecutor.execute
        .mockResolvedValueOnce({ success: true, output: "/test/project" })
        .mockResolvedValueOnce({ success: true, output: "file1\nfile2" });
      mockFileExecutor.execute.mockResolvedValue({
        success: true,
        output: "# Test Project",
      });

      const result = await manager.processResponse(response, testContext);

      expect(result.toolResults).toHaveLength(3);
      expect(mockShellExecutor.execute).toHaveBeenCalledTimes(2);
      expect(mockFileExecutor.execute).toHaveBeenCalledTimes(1);
      expect(result.enhancedResponse).toContain("/test/project");
      expect(result.enhancedResponse).toContain("# Test Project");
      expect(result.enhancedResponse).toContain("file1");
    });

    it("should handle tool execution errors", async () => {
      const response = "<execute>invalid-command</execute>";
      const toolInvocation: ToolInvocation = {
        toolName: "shell",
        action: "execute",
        parameters: { command: "invalid-command" },
        rawMatch: "<execute>invalid-command</execute>",
      };

      mockDetector.detectTools.mockReturnValue([toolInvocation]);
      mockShellExecutor.execute.mockResolvedValue({
        success: false,
        error: "Command not found: invalid-command",
      });

      const result = await manager.processResponse(response, testContext);

      expect(result.toolResults[0]).toEqual({
        toolName: "shell",
        success: false,
        error: "Command not found: invalid-command",
        duration: expect.any(Number),
      });
      expect(result.enhancedResponse).toContain("Error: Command not found");
    });

    it("should handle executor exceptions", async () => {
      const response = "<execute>test</execute>";
      const toolInvocation: ToolInvocation = {
        toolName: "shell",
        action: "execute",
        parameters: { command: "test" },
        rawMatch: "<execute>test</execute>",
      };

      mockDetector.detectTools.mockReturnValue([toolInvocation]);
      mockShellExecutor.execute.mockRejectedValue(new Error("Executor crashed"));

      const result = await manager.processResponse(response, testContext);

      expect(result.toolResults[0]).toEqual({
        toolName: "shell",
        success: false,
        error: "Executor crashed",
        duration: expect.any(Number),
      });
    });

    it("should handle unknown tool types", async () => {
      const response = "<unknown>test</unknown>";
      const toolInvocation: ToolInvocation = {
        toolName: "unknown",
        action: "test",
        parameters: {},
        rawMatch: "<unknown>test</unknown>",
      };

      mockDetector.detectTools.mockReturnValue([toolInvocation]);

      const result = await manager.processResponse(response, testContext);

      expect(result.toolResults[0]).toEqual({
        toolName: "unknown",
        success: false,
        error: "Unknown tool: unknown",
        duration: expect.any(Number),
      });
    });

    it("should preserve text between tool invocations", async () => {
      const response = `Starting the setup process.
<execute>npm init -y</execute>
Great! Now let's install dependencies.
<execute>npm install express</execute>
All done!`;

      const tools: ToolInvocation[] = [
        {
          toolName: "shell",
          action: "execute",
          parameters: { command: "npm init -y" },
          rawMatch: "<execute>npm init -y</execute>",
        },
        {
          toolName: "shell",
          action: "execute",
          parameters: { command: "npm install express" },
          rawMatch: "<execute>npm install express</execute>",
        },
      ];

      mockDetector.detectTools.mockReturnValue(tools);
      mockShellExecutor.execute.mockResolvedValue({ success: true, output: "Done" });

      const result = await manager.processResponse(response, testContext);

      expect(result.enhancedResponse).toContain("Starting the setup process.");
      expect(result.enhancedResponse).toContain("Great! Now let's install dependencies.");
      expect(result.enhancedResponse).toContain("All done!");
    });

    it("should track execution duration", async () => {
      const response = "<execute>sleep 0.1</execute>";
      const toolInvocation: ToolInvocation = {
        toolName: "shell",
        action: "execute",
        parameters: { command: "sleep 0.1" },
        rawMatch: "<execute>sleep 0.1</execute>",
      };

      mockDetector.detectTools.mockReturnValue([toolInvocation]);
      mockShellExecutor.execute.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, output: "" };
      });

      const result = await manager.processResponse(response, testContext);

      expect(result.toolResults[0].duration).toBeGreaterThan(90);
      expect(result.toolResults[0].duration).toBeLessThan(200);
    });

    it("should format different output types correctly", async () => {
      const response = `<execute>echo "Hello"</execute>
<write file="test.json">{"key": "value"}</write>`;

      const tools: ToolInvocation[] = [
        {
          toolName: "shell",
          action: "execute",
          parameters: { command: 'echo "Hello"' },
          rawMatch: '<execute>echo "Hello"</execute>',
        },
        {
          toolName: "file",
          action: "write",
          parameters: { path: "test.json", content: '{"key": "value"}' },
          rawMatch: '<write file="test.json">{"key": "value"}</write>',
        },
      ];

      mockDetector.detectTools.mockReturnValue(tools);
      mockShellExecutor.execute.mockResolvedValue({ success: true, output: "Hello\n" });
      mockFileExecutor.execute.mockResolvedValue({
        success: true,
        output: "File written successfully",
      });

      const result = await manager.processResponse(response, testContext);

      expect(result.enhancedResponse).toContain("```\nHello\n```");
      expect(result.enhancedResponse).toContain("File written successfully");
    });
  });

  describe("executor selection", () => {
    it("should select correct executor for each tool", async () => {
      const tools: ToolInvocation[] = [
        { toolName: "shell", action: "execute", parameters: {}, rawMatch: "" },
        { toolName: "file", action: "read", parameters: {}, rawMatch: "" },
        { toolName: "file", action: "write", parameters: {}, rawMatch: "" },
        { toolName: "search", action: "search", parameters: {}, rawMatch: "" },
        { toolName: "api", action: "request", parameters: {}, rawMatch: "" },
      ];

      for (const tool of tools) {
        mockDetector.detectTools.mockReturnValue([tool]);
        await manager.processResponse(tool.rawMatch, testContext);
      }

      // Shell executor for shell tools
      expect(mockShellExecutor.execute).toHaveBeenCalledTimes(1);
      
      // File executor for file tools
      expect(mockFileExecutor.execute).toHaveBeenCalledTimes(2);
      
      // Others should fail with "Unknown tool"
      // 3 unknown tools (search, api, and implicitly "search" which maps to file)
    });
  });
});