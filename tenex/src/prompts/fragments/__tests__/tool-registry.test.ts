import { describe, test, expect } from "bun:test";
import { getTool } from "@/tools/registry";

describe("Tool Registry", () => {
    test("should have tools with structured parameters", () => {
        // Test that the tool registry has proper structure
        const readFileTool = getTool("read_file");
        expect(readFileTool).toBeDefined();
        expect(readFileTool?.description).toContain("Read a file from the filesystem");
        expect(readFileTool?.parameters).toBeDefined();
        expect(readFileTool?.parameters.shape).toBeDefined();
        expect(readFileTool?.parameters.validate).toBeInstanceOf(Function);
        expect(readFileTool?.execute).toBeInstanceOf(Function);

        const analyzeTool = getTool("analyze");
        expect(analyzeTool).toBeDefined();
        expect(analyzeTool?.description).toBeDefined();
        expect(analyzeTool?.parameters).toBeDefined();
        expect(analyzeTool?.parameters.shape).toBeDefined();

        const claudeCodeTool = getTool("claude_code");
        expect(claudeCodeTool).toBeDefined();
        expect(claudeCodeTool?.description).toContain("Use Claude Code");
        expect(claudeCodeTool?.parameters).toBeDefined();
        expect(claudeCodeTool?.parameters.shape).toBeDefined();

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
            expect(tool?.parameters.shape).toBeDefined();
            expect(tool?.parameters.validate).toBeInstanceOf(Function);
            expect(tool?.execute).toBeInstanceOf(Function);
        }
    });

    test("tool parameters should have proper validation", () => {
        const claudeCodeTool = getTool("claude_code");
        expect(claudeCodeTool?.parameters).toBeDefined();
        expect(claudeCodeTool?.parameters.shape).toBeDefined();
        
        // The shape for a ZodObject has type "object" and properties
        expect(claudeCodeTool?.parameters.shape.type).toBe("object");
        expect(claudeCodeTool?.parameters.shape.properties).toBeDefined();
        expect(claudeCodeTool?.parameters.shape.properties?.prompt).toBeDefined();
        expect(claudeCodeTool?.parameters.shape.properties?.mode).toBeDefined();
        
        // Test validation
        const result = claudeCodeTool?.parameters.validate({
            prompt: "Test prompt",
            mode: "run"
        });
        expect(result?.ok).toBe(true);
        
        const invalidResult = claudeCodeTool?.parameters.validate({
            prompt: "",
            mode: "invalid"
        });
        expect(invalidResult?.ok).toBe(false);
    });
});
