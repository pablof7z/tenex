import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Mock } from "bun:test";
import { ToolEnabledProvider } from "../../llm/ToolEnabledProvider";
import type {
    LLMConfig,
    LLMContext,
    LLMMessage,
    LLMProvider,
    LLMResponse,
    ProviderTool,
} from "../../llm/types";
import { ToolRegistry } from "../ToolRegistry";
import type { ToolDefinition } from "../types";

type MockedLLMProvider = {
    generateResponse: Mock<
        (
            messages: LLMMessage[],
            config: LLMConfig,
            context?: LLMContext,
            tools?: ProviderTool[]
        ) => Promise<LLMResponse>
    >;
};

describe("Tool Execution Integration", () => {
    let mockProvider: MockedLLMProvider;
    let toolRegistry: ToolRegistry;
    let toolEnabledProvider: ToolEnabledProvider;

    beforeEach(() => {
        mockProvider = {
            generateResponse: mock(),
        };
        toolRegistry = new ToolRegistry();
        toolEnabledProvider = new ToolEnabledProvider(
            mockProvider as LLMProvider,
            toolRegistry,
            "openrouter"
        );
    });

    describe("Text-based tool call execution (like deepseek)", () => {
        test("should execute tool when LLM returns <tool_use> format", async () => {
            // Register a simple tool
            const mockTool: ToolDefinition = {
                name: "read_specs",
                description: "Read project specifications",
                parameters: [],
                execute: mock(async () => ({
                    success: true,
                    output: "SPEC.md contains project documentation",
                })),
            };
            toolRegistry.register(mockTool);

            // Simulate LLM response with tool use
            const llmResponse: LLMResponse = {
                content: `I'll read the specifications for you.

<tool_use>
{
  "tool": "read_specs",
  "arguments": {}
}
</tool_use>`,
                model: "deepseek/deepseek-chat-v3-0324",
            };

            mockProvider.generateResponse.mockResolvedValue(llmResponse);

            // Execute
            const result = await toolEnabledProvider.generateResponse(
                [{ role: "user", content: "Please read the project specs" }],
                {},
                {}
            );

            // Verify tool was executed
            expect(mockTool.execute).toHaveBeenCalledTimes(1);

            // Verify response contains tool output
            expect(result.content).toContain("SPEC.md contains project documentation");

            // Verify tool markup was removed
            expect(result.content).not.toContain("<tool_use>");
            expect(result.content).not.toContain('"tool": "read_specs"');
        });

        test("should handle multiple sequential tool calls", async () => {
            // Register tools
            const timeTool: ToolDefinition = {
                name: "get_time",
                description: "Get current time",
                parameters: [
                    {
                        name: "format",
                        type: "string",
                        description: "Time format",
                        required: false,
                    },
                ],
                execute: mock(async (args) => ({
                    success: true,
                    output: `Current time (${args.format || "iso"}): 2024-01-13T10:30:00Z`,
                })),
            };

            const specsTool: ToolDefinition = {
                name: "read_specs",
                description: "Read project specifications",
                parameters: [
                    {
                        name: "spec_name",
                        type: "string",
                        description: "Specification name",
                        required: false,
                    },
                ],
                execute: mock(async (args) => ({
                    success: true,
                    output: `${args.spec_name || "SPEC"}.md: Project documentation loaded`,
                })),
            };

            toolRegistry.register(timeTool);
            toolRegistry.register(specsTool);

            // Simulate LLM response with multiple tool uses
            const llmResponse: LLMResponse = {
                content: `I'll get the time and read the specs.

<tool_use>
{
  "tool": "get_time",
  "arguments": {
    "format": "unix"
  }
}
</tool_use>

<tool_use>
{
  "tool": "read_specs",
  "arguments": {
    "spec_name": "ARCHITECTURE"
  }
}
</tool_use>`,
                model: "deepseek/deepseek-chat-v3-0324",
            };

            mockProvider.generateResponse.mockResolvedValue(llmResponse);

            // Execute
            const result = await toolEnabledProvider.generateResponse(
                [{ role: "user", content: "Get time and read architecture specs" }],
                {},
                {}
            );

            // Verify both tools were executed
            expect(timeTool.execute).toHaveBeenCalledTimes(1);
            expect(specsTool.execute).toHaveBeenCalledTimes(1);

            // Verify arguments were passed correctly
            expect(timeTool.execute).toHaveBeenCalledWith({ format: "unix" }, expect.any(Object));
            expect(specsTool.execute).toHaveBeenCalledWith(
                {
                    spec_name: "ARCHITECTURE",
                },
                expect.any(Object)
            );

            // Verify both tool outputs are in response
            expect(result.content).toContain("Current time (unix): 2024-01-13T10:30:00Z");
            expect(result.content).toContain("ARCHITECTURE.md: Project documentation loaded");
        });

        test("should handle tool execution errors gracefully", async () => {
            // Register a failing tool
            const failingTool: ToolDefinition = {
                name: "failing_tool",
                description: "A tool that fails",
                parameters: [],
                execute: mock(async () => ({
                    success: false,
                    error: "File not found",
                })),
            };
            toolRegistry.register(failingTool);

            // Simulate LLM response with failing tool
            const llmResponse: LLMResponse = {
                content: `<tool_use>
{
  "tool": "failing_tool",
  "arguments": {}
}
</tool_use>`,
                model: "deepseek/deepseek-chat-v3-0324",
            };

            mockProvider.generateResponse.mockResolvedValue(llmResponse);

            // Execute
            const result = await toolEnabledProvider.generateResponse(
                [{ role: "user", content: "Use the failing tool" }],
                {},
                {}
            );

            // Verify tool was executed
            expect(failingTool.execute).toHaveBeenCalledTimes(1);

            // Verify error is in response
            expect(result.content).toContain("Error: File not found");
        });

        test("should handle unknown tools gracefully", async () => {
            // Don't register any tools

            // Simulate LLM response with unknown tool
            const llmResponse: LLMResponse = {
                content: `<tool_use>
{
  "tool": "unknown_tool",
  "arguments": {}
}
</tool_use>`,
                model: "deepseek/deepseek-chat-v3-0324",
            };

            mockProvider.generateResponse.mockResolvedValue(llmResponse);

            // Execute
            const result = await toolEnabledProvider.generateResponse(
                [{ role: "user", content: "Use unknown tool" }],
                {},
                {}
            );

            // Verify error message for unknown tool
            expect(result.content).toContain("Error: Tool 'unknown_tool' not found");
        });
    });

    describe("Native function calling execution (like Claude/GPT)", () => {
        test("should handle responses without text-based tool calls", async () => {
            // Register a tool
            const mockTool: ToolDefinition = {
                name: "get_weather",
                description: "Get weather information",
                parameters: [],
                execute: mock(async () => ({
                    success: true,
                    output: "Weather: Sunny, 25°C",
                })),
            };
            toolRegistry.register(mockTool);

            // Mock response without any tool calls (neither text-based nor native)
            const normalResponse: LLMResponse = {
                content:
                    "I can help you with weather information, but I need you to specify a location.",
                model: "claude-3-sonnet",
            };

            mockProvider.generateResponse.mockResolvedValue(normalResponse);

            // Execute
            const result = await toolEnabledProvider.generateResponse(
                [{ role: "user", content: "What's the weather?" }],
                {},
                {}
            );

            // Verify no tools were executed for regular responses
            expect(mockTool.execute).toHaveBeenCalledTimes(0);

            // Verify only one LLM call was made
            expect(mockProvider.generateResponse).toHaveBeenCalledTimes(1);

            // Verify response is returned as-is
            expect(result.content).toBe(
                "I can help you with weather information, but I need you to specify a location."
            );
        });
    });

    describe("No tool calls", () => {
        test("should pass through responses without tool calls unchanged", async () => {
            // Simulate regular LLM response without tools
            const llmResponse: LLMResponse = {
                content: "This is a regular response without any tool usage.",
                model: "deepseek/deepseek-chat-v3-0324",
            };

            mockProvider.generateResponse.mockResolvedValue(llmResponse);

            // Execute
            const result = await toolEnabledProvider.generateResponse(
                [{ role: "user", content: "Just tell me a joke" }],
                {},
                {}
            );

            // Verify response is unchanged
            expect(result).toEqual(llmResponse);

            // Verify only one LLM call was made
            expect(mockProvider.generateResponse).toHaveBeenCalledTimes(1);
        });
    });

    describe("Tool registry system prompts", () => {
        test("should add tool instructions to system prompt when tools are available", async () => {
            // Register a tool
            const mockTool: ToolDefinition = {
                name: "test_tool",
                description: "A test tool",
                parameters: [],
                execute: mock(async () => ({ success: true, output: "test" })),
            };
            toolRegistry.register(mockTool);

            // Simulate LLM response
            const llmResponse: LLMResponse = {
                content: "Response without tools",
                model: "test-model",
            };

            mockProvider.generateResponse.mockResolvedValue(llmResponse);

            // Execute
            await toolEnabledProvider.generateResponse(
                [{ role: "user", content: "Help me" }],
                {},
                {}
            );

            // Verify system prompt was enhanced with tool information
            const calledMessages = mockProvider.generateResponse.mock.calls[0][0];
            const systemMessage = calledMessages.find((m: LLMMessage) => m.role === "system");

            expect(systemMessage).toBeDefined();
            expect(systemMessage.content).toContain("You have access to the following tools");
            expect(systemMessage.content).toContain("test_tool");
            expect(systemMessage.content).toContain("<tool_use>");
        });
    });
});
