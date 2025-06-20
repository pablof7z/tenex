import { describe, expect, test } from "bun:test";
import { hasToolCalls, parseToolCalls, removeToolCalls } from "../ToolParser";

describe("Text-based Tool Call Handling", () => {
    describe("ToolParser - Core functionality", () => {
        test("should parse basic tool call format correctly", () => {
            const content = `<tool_use>
{
  "tool": "read_specs",
  "arguments": {}
}
</tool_use>`;

            const toolCalls = parseToolCalls(content);

            expect(toolCalls).toHaveLength(1);
            expect(toolCalls[0].name).toBe("read_specs");
            expect(toolCalls[0].arguments).toEqual({});
        });

        test("should detect tool calls correctly", () => {
            const withTools = `<tool_use>{"tool": "test", "arguments": {}}</tool_use>`;
            const withoutTools = "Just regular text content";

            expect(hasToolCalls(withTools)).toBe(true);
            expect(hasToolCalls(withoutTools)).toBe(false);
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

            const cleaned = removeToolCalls(content);

            expect(cleaned).toBe("Before tool call.\n\nAfter tool call.");
            expect(cleaned).not.toContain("<tool_use>");
        });
    });
});
