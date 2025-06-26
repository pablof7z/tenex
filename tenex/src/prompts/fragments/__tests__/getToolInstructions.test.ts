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

        const shellTool = getTool("shell");
        expect(shellTool).toBeDefined();
        expect(shellTool?.description).toBeDefined();
        expect(shellTool?.parameters).toBeDefined();

        const claudeCodeTool = getTool("claude_code");
        expect(claudeCodeTool).toBeDefined();
        expect(claudeCodeTool?.description).toContain("Use Claude Code");
        expect(claudeCodeTool?.parameters).toHaveLength(2); // prompt and mode

        const switchPhaseTool = getTool("switch_phase");
        expect(switchPhaseTool).toBeDefined();
        expect(switchPhaseTool?.description).toContain("Transition to a different workflow phase");
        expect(switchPhaseTool?.parameters).toHaveLength(3); // phase, reason, message

        const handoffTool = getTool("handoff");
        expect(handoffTool).toBeDefined();
        expect(handoffTool?.description).toContain("Hand off the conversation to another agent");
        expect(handoffTool?.parameters).toHaveLength(2); // target, message
    });

    test("tool registry should have all expected tools with proper structure", () => {
        const expectedTools = [
            "read_file",
            "shell",
            "claude_code",
            "switch_phase",
            "handoff",
            "get_time",
            "analyze",
            "generate_inventory",
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
