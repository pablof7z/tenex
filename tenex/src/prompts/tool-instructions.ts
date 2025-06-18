/**
 * Tool instructions template for agents with tools
 */
export const TOOL_INSTRUCTIONS_PROMPT = (toolDescriptions: string) => `

AVAILABLE TOOLS:
${toolDescriptions}

Tool Usage Instructions:
- Always call tools with the exact parameter names and types specified
- Provide clear descriptions of what you're doing when using tools
- If a tool fails, explain what went wrong and try alternative approaches
- Some tools may modify files or system state - use them carefully

Example of correct response structure with tools:
"""
I'll help you update the specifications. Let me first read the current spec:

<tool_use>
{
  "tool": "read_specs",
  "arguments": {
    "spec_name": "SPEC"
  }
}
</tool_use>

Now I'll update it with the new information:

<tool_use>
{
  "tool": "update_spec",
  "arguments": {
    "filename": "SPEC.md",
    "content": "...",
    "changelog": "Added new feature documentation"
  }
}
</tool_use>

The specification has been updated successfully.

SIGNAL: complete
REASON: Specification updated as requested
"""`;
