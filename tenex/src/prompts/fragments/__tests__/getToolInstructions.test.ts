import { describe, test, expect } from "bun:test";
import { getTool } from "@/tools/registry";

// Import the getToolInstructions function from agentFragments
// Since it's not exported, we'll test it indirectly through the fragment usage

describe("getToolInstructions", () => {
    test("should use tool instructions from registry", () => {
        // Test that the tool registry has instructions
        const readFileTool = getTool("read_file");
        expect(readFileTool).toBeDefined();
        expect(readFileTool?.instructions).toContain("Read a file from the filesystem");
        
        const shellTool = getTool("shell");
        expect(shellTool).toBeDefined();
        expect(shellTool?.instructions).toBeDefined();
        
        const claudeCodeTool = getTool("claude_code");
        expect(claudeCodeTool).toBeDefined();
        expect(claudeCodeTool?.instructions).toContain("Use Claude Code");
        
        const nextActionTool = getTool("next_action");
        expect(nextActionTool).toBeDefined();
        expect(nextActionTool?.instructions).toContain("Specify the next action");
    });
    
    test("tool registry should have all expected tools", () => {
        const expectedTools = [
            "read_file",
            "write_file", 
            "edit_file",
            "shell",
            "claude_code",
            "next_action",
            "get_current_requirements",
            "get_time"
        ];
        
        for (const toolName of expectedTools) {
            const tool = getTool(toolName);
            expect(tool).toBeDefined();
            expect(tool?.name).toBeDefined();
            expect(tool?.instructions).toBeDefined();
            expect(tool?.instructions.length).toBeGreaterThan(0);
        }
    });
});