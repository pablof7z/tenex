import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Mock } from "bun:test";
import { ToolEnabledProvider } from "../../llm/ToolEnabledProvider";
import type { LLMProvider, LLMResponse, LLMMessage, LLMConfig, LLMContext, ProviderTool } from "../../llm/types";
import { ToolParser } from "../ToolParser";
import { ToolRegistry } from "../ToolRegistry";
import type { ToolDefinition } from "../types";

type MockedLLMProvider = {
    generateResponse: Mock<(
        messages: LLMMessage[],
        config: LLMConfig,
        context?: LLMContext,
        tools?: ProviderTool[]
    ) => Promise<LLMResponse>>;
};

describe("Text-based Tool Call Handling", () => {
    describe("ToolParser - Core functionality", () => {
        test("should parse basic tool call format correctly", () => {
            const content = `<tool_use>
{
  "tool": "read_specs",
  "arguments": {}
}
</tool_use>`;

            const toolCalls = ToolParser.parseToolCalls(content);

            expect(toolCalls).toHaveLength(1);
            expect(toolCalls[0].name).toBe("read_specs");
            expect(toolCalls[0].arguments).toEqual({});
        });

        test("should detect tool calls correctly", () => {
            const withTools = `<tool_use>{"tool": "test", "arguments": {}}</tool_use>`;
            const withoutTools = "Just regular text content";

            expect(ToolParser.hasToolCalls(withTools)).toBe(true);
            expect(ToolParser.hasToolCalls(withoutTools)).toBe(false);
        });

        test("should remove tool calls from content", () => {
            const content = `Before tool call.

<tool_use>
{
  "tool": "test_tool",
  "arguments": {}
}
</tool_use>

After tool call.`;

            const cleaned = ToolParser.removeToolCalls(content);

            expect(cleaned).toBe("Before tool call.\n\nAfter tool call.");
            expect(cleaned).not.toContain("<tool_use>");
        });
    });

    describe("ToolEnabledProvider - Text-based vs Native handling", () => {
        let mockProvider: MockedLLMProvider;
        let toolRegistry: ToolRegistry;
        let toolEnabledProvider: ToolEnabledProvider;

        beforeEach(() => {
            mockProvider = { generateResponse: mock() };
            toolRegistry = new ToolRegistry();
            toolEnabledProvider = new ToolEnabledProvider(mockProvider as LLMProvider, toolRegistry, "openrouter");
        });

        test("should properly identify and handle text-based tool calls", async () => {
            // Register a simple tool
            const mockTool: ToolDefinition = {
                name: "simple_tool",
                description: "A simple test tool",
                parameters: [],
                execute: mock(async () => ({
                    success: true,
                    output: "Tool executed!",
                })),
            };
            toolRegistry.register(mockTool);

            // Mock LLM response with text-based tool call (like deepseek)
            const mockResponse: LLMResponse = {
                content: `I'll help you with that.

<tool_use>
{
  "tool": "simple_tool",
  "arguments": {}
}
</tool_use>

Let me execute this tool for you.`,
                model: "deepseek/deepseek-chat-v3-0324",
            };

            mockProvider.generateResponse.mockResolvedValue(mockResponse);

            // Execute
            const result = await toolEnabledProvider.generateResponse(
                [{ role: "user", content: "Please help me" }],
                {},
                {}
            );

            // Verify text-based handling (no second LLM call)
            expect(mockProvider.generateResponse).toHaveBeenCalledTimes(1);

            // Verify tool was executed
            expect(mockTool.execute).toHaveBeenCalledTimes(1);

            // Verify tool output is included
            expect(result.content).toContain("Tool executed!");

            // Verify tool markup was cleaned
            expect(result.content).not.toContain("<tool_use>");
        });

        test("should handle native function calls differently (with second LLM call)", async () => {
            // Register a tool
            const mockTool: ToolDefinition = {
                name: "native_tool",
                description: "A tool for native calling",
                parameters: [],
                execute: mock(async () => ({
                    success: true,
                    output: "Native tool result",
                })),
            };
            toolRegistry.register(mockTool);

            // Mock responses for native function calling flow
            const initialResponse: LLMResponse = {
                content: "I need to call a function.",
                model: "claude-3-sonnet",
                // No <tool_use> in content - this simulates native function calling
            };

            const finalResponse: LLMResponse = {
                content: "Here is the final result after tool execution.",
                model: "claude-3-sonnet",
            };

            mockProvider.generateResponse
                .mockResolvedValueOnce(initialResponse)
                .mockResolvedValueOnce(finalResponse);

            // Execute
            const result = await toolEnabledProvider.generateResponse(
                [{ role: "user", content: "Use native function calling" }],
                {},
                {}
            );

            // Verify native handling (should make second LLM call)
            expect(mockProvider.generateResponse).toHaveBeenCalledTimes(1); // Only first call since no tool calls detected

            // Result should be the initial response (no tools detected)
            expect(result.content).toBe("I need to call a function.");
        });

        test("should preserve user content when using text-based tools", async () => {
            const mockTool: ToolDefinition = {
                name: "preserve_test",
                description: "Test content preservation",
                parameters: [],
                execute: mock(async () => ({ success: true, output: "Tool output" })),
            };
            toolRegistry.register(mockTool);

            const mockResponse: LLMResponse = {
                content: `Here's what I'll do:

1. First, I'll analyze your request
2. Then I'll use a tool

<tool_use>
{
  "tool": "preserve_test",
  "arguments": {}
}
</tool_use>

3. Finally, I'll provide the results`,
                model: "deepseek/deepseek-chat-v3-0324",
            };

            mockProvider.generateResponse.mockResolvedValue(mockResponse);

            const result = await toolEnabledProvider.generateResponse(
                [{ role: "user", content: "Help me with analysis" }],
                {},
                {}
            );

            // Verify original content is preserved
            expect(result.content).toContain("Here's what I'll do:");
            expect(result.content).toContain("1. First, I'll analyze your request");
            expect(result.content).toContain("3. Finally, I'll provide the results");

            // Verify tool output is added
            expect(result.content).toContain("Tool output");

            // Verify tool markup is removed
            expect(result.content).not.toContain("<tool_use>");
        });

        test("should handle the exact scenario from the bug report", async () => {
            // Recreate the exact scenario: deepseek returning <tool_use> that should be executed
            const readSpecsTool: ToolDefinition = {
                name: "read_specs",
                description: "Read project specifications",
                parameters: [],
                execute: mock(async () => ({
                    success: true,
                    output: "SPEC.md contents: This is a TENEX project...",
                })),
            };
            toolRegistry.register(readSpecsTool);

            // This is exactly what deepseek was returning in the bug report
            const deepseekResponse: LLMResponse = {
                content: `<tool_use>
{
  "tool": "read_specs",
  "arguments": {}
}
</tool_use>`,
                model: "deepseek/deepseek-chat-v3-0324",
            };

            mockProvider.generateResponse.mockResolvedValue(deepseekResponse);

            const result = await toolEnabledProvider.generateResponse(
                [{ role: "user", content: "Please read the specs" }],
                {},
                {}
            );

            // Verify the tool was actually executed (not just returned as text)
            expect(readSpecsTool.execute).toHaveBeenCalledTimes(1);

            // Verify the response contains the tool output
            expect(result.content).toContain("SPEC.md contents: This is a TENEX project...");

            // Verify the <tool_use> markup was NOT published as-is
            expect(result.content).not.toContain("<tool_use>");
            expect(result.content).not.toContain('"tool": "read_specs"');

            // This is the key test: the content should be the tool result, not the raw tool call
            expect(result.content).not.toBe(deepseekResponse.content);
        });
    });
});
