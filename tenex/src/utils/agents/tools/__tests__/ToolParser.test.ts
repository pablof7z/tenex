import { describe, expect, test } from "bun:test";
import { parseToolCalls, removeToolCalls, hasToolCalls } from "../ToolParser";

describe("ToolParser", () => {
    describe("parseToolCalls", () => {
        test("should parse single tool call with simple arguments", () => {
            const content = `I'll help you with that.

<tool_use>
{
  "tool": "read_specs",
  "arguments": {}
}
</tool_use>

Let me check the specifications.`;

            const toolCalls = parseToolCalls(content);

            expect(toolCalls).toHaveLength(1);
            expect(toolCalls[0].name).toBe("read_specs");
            expect(toolCalls[0].arguments).toEqual({});
            expect(toolCalls[0].id).toMatch(/^call_[a-z0-9]{9}$/);
        });

        test("should parse multiple tool calls", () => {
            const content = `Let me execute multiple tools:

<tool_use>
{
  "tool": "get_time",
  "arguments": {
    "format": "iso"
  }
}
</tool_use>

<tool_use>
{
  "tool": "read_specs",
  "arguments": {
    "spec_name": "SPEC"
  }
}
</tool_use>

Done!`;

            const toolCalls = parseToolCalls(content);

            expect(toolCalls).toHaveLength(2);

            expect(toolCalls[0].name).toBe("get_time");
            expect(toolCalls[0].arguments).toEqual({ format: "iso" });

            expect(toolCalls[1].name).toBe("read_specs");
            expect(toolCalls[1].arguments).toEqual({
                spec_name: "SPEC",
            });
        });

        test("should handle tool calls with complex nested arguments", () => {
            const content = `<tool_use>
{
  "tool": "complex_tool",
  "arguments": {
    "config": {
      "nested": {
        "value": 42,
        "array": [1, 2, 3]
      }
    },
    "flags": ["verbose", "debug"]
  }
}
</tool_use>`;

            const toolCalls = parseToolCalls(content);

            expect(toolCalls).toHaveLength(1);
            expect(toolCalls[0].name).toBe("complex_tool");
            expect(toolCalls[0].arguments).toEqual({
                config: {
                    nested: {
                        value: 42,
                        array: [1, 2, 3],
                    },
                },
                flags: ["verbose", "debug"],
            });
        });

        test("should handle malformed JSON gracefully", () => {
            const content = `<tool_use>
{
  "tool": "bad_tool",
  "arguments": {
    "incomplete": "value"
  // missing closing brace
}
</tool_use>`;

            const toolCalls = parseToolCalls(content);

            // Should return empty array for malformed JSON
            expect(toolCalls).toHaveLength(0);
        });

        test("should handle escaped quotes in arguments", () => {
            const content = `<tool_use>
{
  "tool": "write_code",
  "arguments": {
    "code": "const message = \\\\"Hello, world!\\\\";"
  }
}
</tool_use>`;

            const toolCalls = parseToolCalls(content);

            expect(toolCalls).toHaveLength(1);
            expect(toolCalls[0].arguments).toEqual({
                code: 'const message = "Hello, world!";',
            });
        });

        test("should parse tool calls with string arguments that are JSON", () => {
            const content = `<tool_use>
{
  "tool": "process_data",
  "arguments": "{\\"key\\": \\"value\\", \\"number\\": 123}"
}
</tool_use>`;

            const toolCalls = parseToolCalls(content);

            expect(toolCalls).toHaveLength(1);
            expect(toolCalls[0].arguments).toEqual({ key: "value", number: 123 });
        });

        test("should handle multiline JSON with proper formatting", () => {
            const content = `<tool_use>
{
  "tool": "multiline_tool",
  "arguments": {
    "script": "#!/bin/bash\\necho \\"Starting process\\"\\nfor i in {1..5}; do\\n  echo \\"Step $i\\"\\ndone",
    "options": {
      "executable": true,
      "timeout": 30
    }
  }
}
</tool_use>`;

            const toolCalls = parseToolCalls(content);

            expect(toolCalls).toHaveLength(1);
            expect(toolCalls[0].name).toBe("multiline_tool");
            expect(toolCalls[0].arguments.script).toContain("#!/bin/bash\\necho");
            expect(toolCalls[0].arguments.options).toEqual({
                executable: true,
                timeout: 30,
            });
        });

        test("should parse Anthropic-style tool use format", () => {
            const content = `I'll help you with that. Let me use a tool:

{
  "type": "tool_use",
  "name": "get_time",
  "input": {
    "format": "unix"
  }
}

Getting current time...`;

            const toolCalls = parseToolCalls(content);

            expect(toolCalls).toHaveLength(1);
            expect(toolCalls[0].name).toBe("get_time");
            expect(toolCalls[0].arguments).toEqual({
                format: "unix",
            });
        });

        test("should parse OpenAI function calling style", () => {
            const content = `{
  "function_call": {
    "name": "get_weather",
    "arguments": "{\\"location\\": \\"San Francisco\\", \\"unit\\": \\"celsius\\"}"
  }
}`;

            const toolCalls = parseToolCalls(content);

            expect(toolCalls).toHaveLength(1);
            expect(toolCalls[0].name).toBe("get_weather");
            expect(toolCalls[0].arguments).toEqual({
                location: "San Francisco",
                unit: "celsius",
            });
        });

        test("should return empty array for content without tool calls", () => {
            const content = `This is just regular text without any tool calls.
      
It might have some code blocks:

\`\`\`javascript
console.log('hello');
\`\`\`

But no actual tool use.`;

            const toolCalls = parseToolCalls(content);

            expect(toolCalls).toHaveLength(0);
        });

        test("should handle whitespace variations in tool_use tags", () => {
            const content = `<tool_use>    
{
  "tool": "spaced_tool",
  "arguments": {
    "value": "test"
  }
}    
</tool_use>`;

            const toolCalls = parseToolCalls(content);

            expect(toolCalls).toHaveLength(1);
            expect(toolCalls[0].name).toBe("spaced_tool");
            expect(toolCalls[0].arguments).toEqual({ value: "test" });
        });
    });

    describe("removeToolCalls", () => {
        test("should remove tool_use blocks from content", () => {
            const content = `I'll help you with that.

<tool_use>
{
  "tool": "read_specs",
  "arguments": {}
}
</tool_use>

Let me check the specifications and get back to you.`;

            const cleaned = removeToolCalls(content);

            expect(cleaned).toBe(`I'll help you with that.

Let me check the specifications and get back to you.`);
        });

        test("should remove multiple tool_use blocks", () => {
            const content = `First I'll get the time:

<tool_use>
{
  "tool": "get_time",
  "arguments": {"format": "locale"}
}
</tool_use>

Then I'll read the specs:

<tool_use>
{
  "tool": "read_specs",  
  "arguments": {}
}
</tool_use>

All done!`;

            const cleaned = removeToolCalls(content);

            expect(cleaned).toBe(`First I'll get the time:

Then I'll read the specs:

All done!`);
        });

        test("should remove Anthropic-style tool uses", () => {
            const content = `Let me get the current time:

{
  "type": "tool_use",
  "name": "get_time",
  "input": {"format": "iso"}
}

Got the time!`;

            const cleaned = removeToolCalls(content);

            expect(cleaned).toBe(`Let me get the current time:

Got the time!`);
        });

        test("should clean up excessive whitespace after removal", () => {
            const content = `Text before.



<tool_use>
{
  "tool": "test_tool",
  "arguments": {}
}
</tool_use>



Text after.`;

            const cleaned = removeToolCalls(content);

            expect(cleaned).toBe(`Text before.

Text after.`);
        });

        test("should handle content with only tool calls", () => {
            const content = `<tool_use>
{
  "tool": "only_tool",
  "arguments": {}
}
</tool_use>`;

            const cleaned = removeToolCalls(content);

            expect(cleaned).toBe("");
        });
    });

    describe("hasToolCalls", () => {
        test("should return true when content has tool calls", () => {
            const content = `<tool_use>
{
  "tool": "test_tool",
  "arguments": {}
}
</tool_use>`;

            expect(hasToolCalls(content)).toBe(true);
        });

        test("should return false when content has no tool calls", () => {
            const content = "This is just regular text content.";

            expect(hasToolCalls(content)).toBe(false);
        });

        test("should return true for Anthropic-style tool calls", () => {
            const content = `{
  "type": "tool_use",
  "name": "test_tool",
  "input": {}
}`;

            expect(hasToolCalls(content)).toBe(true);
        });

        test("should return true for OpenAI function calls", () => {
            const content = `{
  "function_call": {
    "name": "test_function",
    "arguments": "{}"
  }
}`;

            expect(hasToolCalls(content)).toBe(true);
        });
    });
});
