import { describe, it, expect, beforeEach } from "vitest";
import { ToolExecutor } from "../ToolExecutor";
import { ToolRegistry } from "../ToolRegistry";
import type { Tool, ToolCall } from "../types";

describe("ToolExecutor - Fuzzy Matching", () => {
    let toolRegistry: ToolRegistry;
    let toolExecutor: ToolExecutor;
    let mockTool: Tool;

    beforeEach(() => {
        toolRegistry = new ToolRegistry();
        toolExecutor = new ToolExecutor(toolRegistry);

        mockTool = {
            name: "read_specs",
            description: "Read project specifications",
            parameters: [],
            execute: async () => ({
                success: true,
                output: "Mock spec content"
            })
        };

        toolRegistry.register(mockTool);
    });

    it("should execute tool with exact name match", async () => {
        const toolCall: ToolCall = {
            id: "test-1",
            name: "read_specs",
            arguments: {}
        };

        const result = await toolExecutor.executeTool(toolCall);

        expect(result.tool_call_id).toBe("test-1");
        expect(result.output).toBe("Mock spec content");
    });

    it("should execute tool with default_api prefix removed", async () => {
        const toolCall: ToolCall = {
            id: "test-2",
            name: "default_api.read_specs",
            arguments: {}
        };

        const result = await toolExecutor.executeTool(toolCall);

        expect(result.tool_call_id).toBe("test-2");
        expect(result.output).toBe("Mock spec content");
    });

    it("should execute tool with api prefix removed", async () => {
        const toolCall: ToolCall = {
            id: "test-3",
            name: "api.read_specs",
            arguments: {}
        };

        const result = await toolExecutor.executeTool(toolCall);

        expect(result.tool_call_id).toBe("test-3");
        expect(result.output).toBe("Mock spec content");
    });

    it("should execute tool with tools prefix removed", async () => {
        const toolCall: ToolCall = {
            id: "test-4",
            name: "tools.read_specs",
            arguments: {}
        };

        const result = await toolExecutor.executeTool(toolCall);

        expect(result.tool_call_id).toBe("test-4");
        expect(result.output).toBe("Mock spec content");
    });

    it("should fail gracefully when tool not found even with prefix cleaning", async () => {
        const toolCall: ToolCall = {
            id: "test-5",
            name: "default_api.nonexistent_tool",
            arguments: {}
        };

        const result = await toolExecutor.executeTool(toolCall);

        expect(result.tool_call_id).toBe("test-5");
        expect(result.output).toContain("Tool 'default_api.nonexistent_tool' not found");
        expect(result.output).toContain("Available tools: read_specs");
    });

    it("should not clean prefix if exact match exists", async () => {
        // Register a tool with the prefixed name
        const prefixedTool: Tool = {
            name: "default_api.read_specs",
            description: "Prefixed tool",
            parameters: [],
            execute: async () => ({
                success: true,
                output: "Prefixed tool output"
            })
        };

        toolRegistry.register(prefixedTool);

        const toolCall: ToolCall = {
            id: "test-6",
            name: "default_api.read_specs",
            arguments: {}
        };

        const result = await toolExecutor.executeTool(toolCall);

        expect(result.tool_call_id).toBe("test-6");
        expect(result.output).toBe("Prefixed tool output");
    });
});