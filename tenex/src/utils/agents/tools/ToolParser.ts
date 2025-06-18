import type { ToolCall } from "@/utils/agents/tools/types";

// Parse tool calls from LLM response
// Supports both XML-style tags and JSON blocks
export function parseToolCalls(content: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];

  // Pattern 1: XML-style <tool_use> tags - improved to handle multi-line JSON
  const xmlPattern = /<tool_use>\s*([\s\S]*?)\s*<\/tool_use>/g;
  let match = xmlPattern.exec(content);

  while (match !== null) {
    try {
      // Clean up the JSON string - handle potential formatting issues
      const jsonStr = match[1]?.trim();
      if (!jsonStr) continue;

      const toolData = JSON.parse(jsonStr);
      if (toolData.tool && typeof toolData.tool === "string") {
        // Handle arguments that might be JSON strings themselves
        let args = toolData.arguments || {};
        if (typeof args === "string") {
          try {
            args = JSON.parse(args);
          } catch (_e) {
            // Keep as string if parsing fails
          }
        }

        toolCalls.push({
          id: `call_${Math.random().toString(36).substr(2, 9)}`,
          name: toolData.tool,
          arguments: args,
        });
      }
    } catch (_e) {
      // Silently ignore malformed JSON in tool calls
    }
    match = xmlPattern.exec(content);
  }

  // Pattern 2: Anthropic-style tool use
  // Looking for patterns like "I'll use the search_files tool..."
  const anthropicPattern =
    /\{\s*"type"\s*:\s*"tool_use"\s*,\s*"name"\s*:\s*"([^"]+)"\s*,\s*"input"\s*:\s*({[\s\S]*?})\s*\}/g;

  match = anthropicPattern.exec(content);
  while (match !== null) {
    try {
      const toolName = match[1];
      const toolArgsStr = match[2];
      if (!toolName || !toolArgsStr) continue;
      const toolArgs = JSON.parse(toolArgsStr);
      toolCalls.push({
        id: `call_${Math.random().toString(36).substr(2, 9)}`,
        name: toolName,
        arguments: toolArgs,
      });
    } catch (_e) {
      // Silently ignore malformed Anthropic tool format
    }
    match = anthropicPattern.exec(content);
  }

  // Pattern 3: OpenAI function calling style
  const functionPattern =
    /\{\s*"function_call"\s*:\s*\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*"([^"]+)"\s*\}\s*\}/g;

  match = functionPattern.exec(content);
  while (match !== null) {
    try {
      const toolName = match[1];
      const toolArgsStr = match[2];
      if (!toolName || !toolArgsStr) continue;
      const toolArgs = JSON.parse(toolArgsStr);
      toolCalls.push({
        id: `call_${Math.random().toString(36).substr(2, 9)}`,
        name: toolName,
        arguments: toolArgs,
      });
    } catch (_e) {
      // Silently ignore malformed OpenAI function calls
    }
    match = functionPattern.exec(content);
  }

  return toolCalls;
}

// Remove tool calls from content to get clean response
export function removeToolCalls(content: string): string {
  // Remove XML-style tool uses
  let cleaned = content.replace(/<tool_use>\s*{[\s\S]*?}\s*<\/tool_use>/g, "");

  // Remove Anthropic-style tool uses
  cleaned = cleaned.replace(/\{\s*"type"\s*:\s*"tool_use"[\s\S]*?\}/g, "");

  // Remove OpenAI function calls
  cleaned = cleaned.replace(/\{\s*"function_call"\s*:[\s\S]*?\}/g, "");

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, "\n\n").trim();

  return cleaned;
}

// Check if content contains tool calls
export function hasToolCalls(content: string): boolean {
  return parseToolCalls(content).length > 0;
}
