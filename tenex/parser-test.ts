// Test the parser with various function call formats

import { FunctionCallParser } from "./llm-tools-example.ts";

const parser = new FunctionCallParser();

const testCases = [
  {
    name: "OpenAI/Anthropic XML style",
    text: `<function_calls>
<invoke name="get_current_time">
<parameter name="timezone">America/New_York</parameter>
<parameter name="format">12h</parameter>
</invoke>
</function_calls>`,
  },
  {
    name: "JSON style",
    text: `{"function": "get_current_time", "arguments": {"timezone": "Europe/London"}}`,
  },
  {
    name: "Markdown code block",
    text: `I'll check the time for you.
\`\`\`json
{
  "function": "get_current_time",
  "arguments": {
    "timezone": "Asia/Tokyo",
    "format": "24h"
  }
}
\`\`\``,
  },
  {
    name: "Plain text function call",
    text: `Let me call get_current_time(timezone="America/Los_Angeles", format="12h")`,
  },
  {
    name: "Natural language intent",
    text: `What's the current time in London?`,
  },
  {
    name: "Multiple calls",
    text: `<function_calls>
<invoke name="get_current_time"><parameter name="timezone">UTC</parameter></invoke>
</function_calls>
And also let me check: {"function": "get_current_time", "arguments": {"timezone": "America/Chicago"}}`,
  },
];

console.log("Testing Function Call Parser\n");

for (const testCase of testCases) {
  console.log(`Test: ${testCase.name}`);
  console.log(`Input: ${testCase.text.replace(/\n/g, "\\n")}`);

  const calls = parser.parseFunctionCalls(testCase.text);
  console.log("Parsed calls:", JSON.stringify(calls, null, 2));
  console.log(`${"-".repeat(60)}\n`);
}
