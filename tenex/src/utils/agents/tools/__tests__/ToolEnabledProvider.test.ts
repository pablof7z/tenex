import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Mock } from "bun:test";
import { ToolEnabledProvider } from "@/llm/ToolEnabledProvider";
import type {
    LLMConfig,
    LLMContext,
    LLMMessage,
    LLMProvider,
    LLMResponse,
    ProviderTool,
} from "@/llm/types";
import { ToolRegistry } from "../ToolRegistry";
import type { ToolDefinition, ToolResult } from "../types";

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

// Mock LLM Provider
const createMockProvider = (): MockedLLMProvider => ({
    generateResponse: mock(),
});

// Mock Tool Definition
const createMockTool = (name: string, execute?: () => Promise<ToolResult>): ToolDefinition => ({
    name,
    description: `Mock tool: ${name}`,
    parameters: [
        {
            name: "input",
            type: "string",
            description: "Test input parameter",
            required: false,
        },
    ],
    execute:
        execute ||
        mock(async () => ({
            success: true,
            output: `${name} executed successfully`,
        })),
});

describe("ToolEnabledProvider", () => {
    let mockProvider: MockedLLMProvider;
    let toolRegistry: ToolRegistry;
    let toolEnabledProvider: ToolEnabledProvider;

    beforeEach(() => {
        mockProvider = createMockProvider();
        toolRegistry = new ToolRegistry();
        toolEnabledProvider = new ToolEnabledProvider(
            mockProvider as LLMProvider,
            toolRegistry,
            "openrouter"
        );
    });

    describe("generateResponse with text-based tool calls", () => {
        test("should execute tools and return results for text-based tool calls", async () => {
            // Setup
            const mockTool = createMockTool("read_specs");
            toolRegistry.register(mockTool);

            const messages: LLMMessage[] = [
                { role: "user", content: "Please read the specifications" },
            ];

            const mockResponse: LLMResponse = {
                content: `I'll read the specifications for you.

<tool_use>
{
  "tool": "read_specs",
  "arguments": {}
}
</tool_use>`,
                model: "test-model",
            };

            mockProvider.generateResponse.mockResolvedValue(mockResponse);

            // Execute
            const result = await toolEnabledProvider.generateResponse(messages, {}, {});

            // Verify
            expect(result.content).toContain("read_specs executed successfully");
            expect(result.content).not.toContain("<tool_use>");
            expect(mockTool.execute).toHaveBeenCalledTimes(1);
        });

        test("should handle multiple text-based tool calls", async () => {
            // Setup
            const getTimeTool = createMockTool("get_time");
            const readSpecsTool = createMockTool("read_specs");
            toolRegistry.register(getTimeTool);
            toolRegistry.register(readSpecsTool);

            const messages: LLMMessage[] = [{ role: "user", content: "Get time and read specs" }];

            const mockResponse: LLMResponse = {
                content: `I'll get the time and read specs for you.

<tool_use>
{
  "tool": "get_time",
  "arguments": {"format": "iso"}
}
</tool_use>

<tool_use>
{
  "tool": "read_specs", 
  "arguments": {}
}
</tool_use>`,
                model: "test-model",
            };

            mockProvider.generateResponse.mockResolvedValue(mockResponse);

            // Execute
            const result = await toolEnabledProvider.generateResponse(messages, {}, {});

            // Verify
            expect(result.content).toContain("get_time executed successfully");
            expect(result.content).toContain("read_specs executed successfully");
            expect(result.content).not.toContain("<tool_use>");
            expect(getTimeTool.execute).toHaveBeenCalledTimes(1);
            expect(readSpecsTool.execute).toHaveBeenCalledTimes(1);
        });

        test("should include tool results in response content", async () => {
            // Setup
            const mockTool = createMockTool("get_status", async () => ({
                success: true,
                output: "System status: All services operational",
            }));
            toolRegistry.register(mockTool);

            const messages: LLMMessage[] = [{ role: "user", content: "Check system status" }];

            const mockResponse: LLMResponse = {
                content: `<tool_use>
{
  "tool": "get_status",
  "arguments": {}
}
</tool_use>`,
                model: "test-model",
            };

            mockProvider.generateResponse.mockResolvedValue(mockResponse);

            // Execute
            const result = await toolEnabledProvider.generateResponse(messages, {}, {});

            // Verify
            expect(result.content).toContain("**Tool: get_status**");
            expect(result.content).toContain("System status: All services operational");
        });

        test("should preserve non-tool content when using text-based tools", async () => {
            // Setup
            const mockTool = createMockTool("helper_tool");
            toolRegistry.register(mockTool);

            const messages: LLMMessage[] = [{ role: "user", content: "Help me with this task" }];

            const mockResponse: LLMResponse = {
                content: `I'll help you with this task. Let me use a tool first.

<tool_use>
{
  "tool": "helper_tool",
  "arguments": {}
}
</tool_use>

The tool will provide additional information.`,
                model: "test-model",
            };

            mockProvider.generateResponse.mockResolvedValue(mockResponse);

            // Execute
            const result = await toolEnabledProvider.generateResponse(messages, {}, {});

            // Verify
            expect(result.content).toContain("I'll help you with this task");
            expect(result.content).toContain("The tool will provide additional information");
            expect(result.content).toContain("helper_tool executed successfully");
            expect(result.content).not.toContain("<tool_use>");
        });
    });

    describe("generateResponse with native function calling", () => {
        test("should make second LLM call for native function calling", async () => {
            // Setup
            const mockTool = createMockTool("native_tool");
            toolRegistry.register(mockTool);

            const messages: LLMMessage[] = [
                { role: "user", content: "Use native function calling" },
            ];

            const initialResponse: LLMResponse = {
                content: "I need to call a function.",
                model: "test-model",
                tool_calls: [
                    {
                        id: "call_123",
                        type: "function",
                        function: {
                            name: "native_tool",
                            arguments: "{}",
                        },
                    },
                ],
            };

            const finalResponse: LLMResponse = {
                content: "Function completed successfully.",
                model: "test-model",
            };

            mockProvider.generateResponse
                .mockResolvedValueOnce(initialResponse)
                .mockResolvedValueOnce(finalResponse);

            // Execute
            const result = await toolEnabledProvider.generateResponse(messages, {}, {});

            // Verify
            expect(mockProvider.generateResponse).toHaveBeenCalledTimes(2);
            expect(result.content).toBe("Function completed successfully.");
            expect(mockTool.execute).toHaveBeenCalledTimes(1);
        });
    });

    describe("generateResponse without tool calls", () => {
        test("should return response as-is when no tool calls detected", async () => {
            // Setup
            const messages: LLMMessage[] = [{ role: "user", content: "Just a regular question" }];

            const mockResponse: LLMResponse = {
                content: "Here is my regular response without any tool calls.",
                model: "test-model",
            };

            mockProvider.generateResponse.mockResolvedValue(mockResponse);

            // Execute
            const result = await toolEnabledProvider.generateResponse(messages, {}, {});

            // Verify
            expect(result).toEqual(mockResponse);
            expect(mockProvider.generateResponse).toHaveBeenCalledTimes(1);
        });
    });

    describe("tool registry integration", () => {
        test("should add tool instructions to system message", async () => {
            // Setup
            const mockTool = createMockTool("test_tool");
            toolRegistry.register(mockTool);

            const messages: LLMMessage[] = [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: "Help me" },
            ];

            const mockResponse: LLMResponse = {
                content: "I can help you!",
                model: "test-model",
            };

            mockProvider.generateResponse.mockResolvedValue(mockResponse);

            // Execute
            await toolEnabledProvider.generateResponse(messages, {}, {});

            // Verify
            const calledMessages = mockProvider.generateResponse.mock.calls[0][0];
            const systemMessage = calledMessages.find((m: LLMMessage) => m.role === "system");

            expect(systemMessage.content).toContain("You have access to the following tools");
            expect(systemMessage.content).toContain("test_tool");
            expect(systemMessage.content).toContain("<tool_use>");
        });

        test("should create system message if none exists", async () => {
            // Setup
            const mockTool = createMockTool("test_tool");
            toolRegistry.register(mockTool);

            const messages: LLMMessage[] = [{ role: "user", content: "Help me" }];

            const mockResponse: LLMResponse = {
                content: "I can help you!",
                model: "test-model",
            };

            mockProvider.generateResponse.mockResolvedValue(mockResponse);

            // Execute
            await toolEnabledProvider.generateResponse(messages, {}, {});

            // Verify
            const calledMessages = mockProvider.generateResponse.mock.calls[0][0];
            expect(calledMessages[0].role).toBe("system");
            expect(calledMessages[0].content).toContain("You have access to the following tools");
        });
    });

    describe("tool execution error handling", () => {
        test("should handle tool execution errors gracefully", async () => {
            // Setup
            const failingTool = createMockTool("failing_tool", async () => ({
                success: false,
                error: "Tool execution failed",
            }));
            toolRegistry.register(failingTool);

            const messages: LLMMessage[] = [{ role: "user", content: "Use the failing tool" }];

            const mockResponse: LLMResponse = {
                content: `<tool_use>
{
  "tool": "failing_tool",
  "arguments": {}
}
</tool_use>`,
                model: "test-model",
            };

            mockProvider.generateResponse.mockResolvedValue(mockResponse);

            // Execute
            const result = await toolEnabledProvider.generateResponse(messages, {}, {});

            // Verify
            expect(result.content).toContain("Error: Tool execution failed");
        });

        test("should handle unknown tools gracefully", async () => {
            // Setup - no tools registered
            const messages: LLMMessage[] = [{ role: "user", content: "Use unknown tool" }];

            const mockResponse: LLMResponse = {
                content: `<tool_use>
{
  "tool": "unknown_tool",
  "arguments": {}
}
</tool_use>`,
                model: "test-model",
            };

            mockProvider.generateResponse.mockResolvedValue(mockResponse);

            // Execute
            const result = await toolEnabledProvider.generateResponse(messages, {}, {});

            // Verify
            expect(result.content).toContain("Error: Tool 'unknown_tool' not found");
        });
    });

    describe("usage statistics", () => {
        test("should preserve usage statistics from base provider", async () => {
            // Setup
            const messages: LLMMessage[] = [{ role: "user", content: "Regular question" }];

            const mockResponse: LLMResponse = {
                content: "Response",
                model: "test-model",
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 5,
                    total_tokens: 15,
                    cost: 0.001,
                },
            };

            mockProvider.generateResponse.mockResolvedValue(mockResponse);

            // Execute
            const result = await toolEnabledProvider.generateResponse(messages, {}, {});

            // Verify
            expect(result.usage).toEqual(mockResponse.usage);
        });

        test("should combine usage statistics for native function calling", async () => {
            // Setup
            const mockTool = createMockTool("usage_tool");
            toolRegistry.register(mockTool);

            const messages: LLMMessage[] = [{ role: "user", content: "Test usage tracking" }];

            const initialResponse: LLMResponse = {
                content: "Function call",
                model: "test-model",
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 5,
                    total_tokens: 15,
                    cost: 0.001,
                },
                tool_calls: [
                    {
                        id: "call_123",
                        type: "function",
                        function: { name: "usage_tool", arguments: "{}" },
                    },
                ],
            };

            const finalResponse: LLMResponse = {
                content: "Final response",
                model: "test-model",
                usage: {
                    prompt_tokens: 15,
                    completion_tokens: 8,
                    total_tokens: 23,
                    cost: 0.002,
                },
            };

            mockProvider.generateResponse
                .mockResolvedValueOnce(initialResponse)
                .mockResolvedValueOnce(finalResponse);

            // Execute
            const result = await toolEnabledProvider.generateResponse(messages, {}, {});

            // Verify
            expect(result.usage).toEqual({
                prompt_tokens: 25,
                completion_tokens: 13,
                total_tokens: 38,
                cache_creation_input_tokens: 0,
                cache_read_input_tokens: 0,
                cost: 0.003,
            });
        });
    });
});
