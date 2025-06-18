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
- Some tools may modify files or system state - use them carefully`;