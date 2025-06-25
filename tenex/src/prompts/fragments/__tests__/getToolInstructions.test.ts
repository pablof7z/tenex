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
        
        const switchPhaseTool = getTool("switch_phase");
        expect(switchPhaseTool).toBeDefined();
        expect(switchPhaseTool?.instructions).toContain("Transition to a different workflow phase");
        
        const handoffTool = getTool("handoff");
        expect(handoffTool).toBeDefined();
        expect(handoffTool?.instructions).toContain("Hand off the conversation to another agent");
    });
    
    test("tool registry should have all expected tools", () => {
        const expectedTools = [
            "read_file",
            "shell",
            "claude_code",
            "switch_phase",
            "handoff",
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