import { describe, it, expect, beforeEach, mock } from "bun:test";
import { AgentExecutor } from "../AgentExecutor";
import * as AgentPromptBuilder from "../AgentPromptBuilder";
import type { AgentExecutionContext, AgentExecutionResult } from "../types";
import type { LLMService } from "@/llm/LLMService";
import type { ConversationPublisher } from "@/nostr/ConversationPublisher";
import { ToolExecutionManager } from "@/tools/execution";
import { createMockLLMService, MockLLMResponse } from "@/test-utils/mocks";
import { createTestAgent, createTestConversation } from "@/test-utils/helpers/fixtures";
import { NDKEvent } from "@nostr-dev-kit/ndk";

// Mock dependencies
jest.mock("../AgentPromptBuilder");
jest.mock("@/tools/execution");
jest.mock("@/nostr/ConversationPublisher");

describe("AgentExecutor", () => {
  let executor: AgentExecutor;
  let mockLLMService: ReturnType<typeof createMockLLMService>;
  let mockPublisher: jest.Mocked<ConversationPublisher>;
  let mockPromptBuilder: jest.Mocked<AgentPromptBuilder>;
  let mockToolManager: jest.Mocked<ToolExecutionManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLLMService = createMockLLMService();
    mockPublisher = {
      publishAgentMessage: jest.fn().mockResolvedValue(new NDKEvent()),
    } as any;
    
    mockPromptBuilder = {
      buildPrompt: jest.fn().mockReturnValue({
        messages: [
          { role: "system", content: "You are a helpful agent" },
          { role: "user", content: "Hello" },
        ],
        availableTools: ["shell", "file"],
      }),
    } as any;

    mockToolManager = {
      processResponse: jest.fn().mockResolvedValue({
        cleanedResponse: "Cleaned response",
        toolResults: [],
        enhancedResponse: "Enhanced response",
      }),
    } as any;

    // Set up constructor mocks
    (AgentPromptBuilder as jest.MockedClass<typeof AgentPromptBuilder>).mockImplementation(
      () => mockPromptBuilder
    );
    (ToolExecutionManager as jest.MockedClass<typeof ToolExecutionManager>).mockImplementation(
      () => mockToolManager
    );

    executor = new AgentExecutor(mockLLMService as any, mockPublisher);
  });

  describe("execute", () => {
    it("should execute agent and return response", async () => {
      const agent = createTestAgent();
      const conversation = createTestConversation();
      const context: AgentExecutionContext = {
        agent,
        conversation,
        phase: "chat",
        lastUserMessage: "Hello",
      };

      mockLLMService.setResponse(new MockLLMResponse("Hello! How can I help you?"));

      const result = await executor.execute(context);

      expect(result.success).toBe(true);
      expect(result.response).toBe("Enhanced response");
      expect(result.error).toBeUndefined();

      // Verify prompt building
      expect(mockPromptBuilder.buildPrompt).toHaveBeenCalledWith(
        agent,
        conversation,
        "chat",
        "Hello"
      );

      // Verify LLM call
      expect(mockLLMService.callHistory).toHaveLength(1);
      expect(mockLLMService.callHistory[0].config).toBe("default");

      // Verify tool processing
      expect(mockToolManager.processResponse).toHaveBeenCalledWith(
        "Hello! How can I help you?",
        expect.objectContaining({
          projectPath: context.projectContext?.projectPath,
          conversationId: conversation.id,
          agentName: agent.name,
          phase: "chat",
        })
      );

      // Verify publishing
      expect(mockPublisher.publishAgentMessage).toHaveBeenCalledWith(
        conversation,
        agent,
        "Enhanced response",
        "chat",
        expect.any(Object)
      );
    });

    it("should handle LLM errors gracefully", async () => {
      const context: AgentExecutionContext = {
        agent: createTestAgent(),
        conversation: createTestConversation(),
        phase: "chat",
      };

      mockLLMService.setThrowError(new Error("LLM service error"));

      const result = await executor.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toBe("LLM service error");
      expect(result.response).toBeUndefined();
      expect(mockPublisher.publishAgentMessage).not.toHaveBeenCalled();
    });

    it("should handle tool execution errors", async () => {
      const context: AgentExecutionContext = {
        agent: createTestAgent(),
        conversation: createTestConversation(),
        phase: "execute",
      };

      mockLLMService.setResponse(new MockLLMResponse("I'll run a command"));
      mockToolManager.processResponse.mockRejectedValue(new Error("Tool error"));

      const result = await executor.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Tool error");
    });

    it("should skip tool processing if agent has no tools", async () => {
      const agent = createTestAgent({ tools: [] });
      const context: AgentExecutionContext = {
        agent,
        conversation: createTestConversation(),
        phase: "chat",
      };

      mockLLMService.setResponse(new MockLLMResponse("Response without tools"));

      const result = await executor.execute(context);

      expect(result.success).toBe(true);
      expect(result.response).toBe("Response without tools");
      expect(mockToolManager.processResponse).not.toHaveBeenCalled();
    });

    it("should include tool results in execution result", async () => {
      const context: AgentExecutionContext = {
        agent: createTestAgent({ tools: ["shell"] }),
        conversation: createTestConversation(),
        phase: "execute",
      };

      const toolResults = [
        {
          toolName: "shell",
          success: true,
          output: "Command output",
          duration: 100,
        },
      ];

      mockLLMService.setResponse(new MockLLMResponse("Running command"));
      mockToolManager.processResponse.mockResolvedValue({
        cleanedResponse: "Cleaned",
        toolResults,
        enhancedResponse: "Enhanced with results",
      });

      const result = await executor.execute(context);

      expect(result.success).toBe(true);
      expect(result.toolExecutions).toEqual(toolResults);
    });

    it("should handle different phases correctly", async () => {
      const agent = createTestAgent();
      const conversation = createTestConversation();

      // Test each phase
      const phases = ["chat", "plan", "execute", "review"] as const;

      for (const phase of phases) {
        mockPromptBuilder.buildPrompt.mockClear();
        
        const context: AgentExecutionContext = {
          agent,
          conversation,
          phase,
        };

        await executor.execute(context);

        expect(mockPromptBuilder.buildPrompt).toHaveBeenCalledWith(
          agent,
          conversation,
          phase,
          undefined
        );
      }
    });

    it("should use agent's custom LLM config", async () => {
      const agent = createTestAgent({ llmConfig: "custom-config" });
      const context: AgentExecutionContext = {
        agent,
        conversation: createTestConversation(),
        phase: "chat",
      };

      await executor.execute(context);

      expect(mockLLMService.callHistory[0].config).toBe("custom-config");
    });

    it("should include LLM metadata in response", async () => {
      const context: AgentExecutionContext = {
        agent: createTestAgent(),
        conversation: createTestConversation(),
        phase: "chat",
      };

      const llmResponse = new MockLLMResponse("Response", {
        model: "claude-3-opus",
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      });

      mockLLMService.setResponse(llmResponse);

      const result = await executor.execute(context);

      expect(result.llmMetadata).toEqual({
        model: "claude-3-opus",
        provider: "mock",
        temperature: undefined,
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      });
    });

    it("should handle publishing errors gracefully", async () => {
      const context: AgentExecutionContext = {
        agent: createTestAgent(),
        conversation: createTestConversation(),
        phase: "chat",
      };

      mockPublisher.publishAgentMessage.mockRejectedValue(
        new Error("Publishing failed")
      );

      const result = await executor.execute(context);

      // Should still return success even if publishing fails
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.publishedEvent).toBeUndefined();
    });

    it("should include project context in execution", async () => {
      const projectContext = {
        projectPath: "/test/project",
        someData: "test",
      };

      const context: AgentExecutionContext = {
        agent: createTestAgent(),
        conversation: createTestConversation(),
        phase: "chat",
        projectContext,
      };

      await executor.execute(context);

      expect(mockToolManager.processResponse).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          projectPath: "/test/project",
        })
      );
    });
  });

  describe("error handling", () => {
    it("should handle missing agent gracefully", async () => {
      const context: AgentExecutionContext = {
        agent: null as any,
        conversation: createTestConversation(),
        phase: "chat",
      };

      const result = await executor.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid execution context");
    });

    it("should handle missing conversation gracefully", async () => {
      const context: AgentExecutionContext = {
        agent: createTestAgent(),
        conversation: null as any,
        phase: "chat",
      };

      const result = await executor.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid execution context");
    });

    it("should handle prompt building errors", async () => {
      const context: AgentExecutionContext = {
        agent: createTestAgent(),
        conversation: createTestConversation(),
        phase: "chat",
      };

      mockPromptBuilder.buildPrompt.mockImplementation(() => {
        throw new Error("Prompt building failed");
      });

      const result = await executor.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Prompt building failed");
    });
  });
});