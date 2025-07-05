import { describe, test, expect } from "bun:test";
import { getTool } from "@/tools/registry";

describe("Tool Registry", () => {
    test("should have tools with structured parameters", () => {
        // Test that the tool registry has proper structure
        const readFileTool = getTool("read_file");
        expect(readFileTool).toBeDefined();
        expect(readFileTool?.description).toContain("Read a file from the filesystem");
        expect(readFileTool?.parameters).toBeDefined();
        expect(readFileTool?.execute).toBeInstanceOf(Function);

        const analyzeTool = getTool("analyze");
        expect(analyzeTool).toBeDefined();
        expect(analyzeTool?.description).toBeDefined();
        expect(analyzeTool?.parameters).toBeDefined();

        const claudeCodeTool = getTool("claude_code");
        expect(claudeCodeTool).toBeDefined();
        expect(claudeCodeTool?.description).toContain("Use Claude Code");
        expect(claudeCodeTool?.parameters).toHaveLength(2); // prompt and mode

        const continueTool = getTool("continue");
        expect(continueTool).toBeDefined();
        expect(continueTool?.description).toBeDefined();
        expect(continueTool?.parameters).toBeDefined();

        const yieldBackTool = getTool("yield_back");
        expect(yieldBackTool).toBeDefined();
        expect(yieldBackTool?.description).toBeDefined();
        expect(yieldBackTool?.parameters).toBeDefined();

        const endConversationTool = getTool("end_conversation");
        expect(endConversationTool).toBeDefined();
        expect(endConversationTool?.description).toBeDefined();
        expect(endConversationTool?.parameters).toBeDefined();
    });

    test("tool registry should have all expected tools with proper structure", () => {
        const expectedTools = [
            "read_file",
            "claude_code",
            "continue",
            "yield_back",
            "end_conversation",
            "analyze",
            "generate_inventory",
            "learn",
            "create_milestone_task",
        ];

        for (const toolName of expectedTools) {
            const tool = getTool(toolName);
            expect(tool).toBeDefined();
            expect(tool?.name).toBe(toolName);
            expect(tool?.description).toBeDefined();
            expect(tool?.description.length).toBeGreaterThan(0);
            expect(tool?.parameters).toBeDefined();
            expect(Array.isArray(tool?.parameters)).toBe(true);
            expect(tool?.execute).toBeInstanceOf(Function);
        }
    });

    test("tool parameters should have proper structure", () => {
        const claudeCodeTool = getTool("claude_code");
        expect(claudeCodeTool?.parameters).toEqual([
            {
                name: "prompt",
                type: "string",
                description: "The task or coding request for Claude Code to perform",
                required: true,
            },
            {
                name: "mode",
                type: "string",
                description:
                    'Execution mode: "run" (default) executes immediately, "plan" creates a plan without executing',
                required: false,
                enum: ["run", "plan"],
            },
        ]);
    });
});
