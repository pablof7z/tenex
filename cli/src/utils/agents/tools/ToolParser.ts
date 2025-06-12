import type { ToolCall } from './types';

export class ToolParser {
  // Parse tool calls from LLM response
  // Supports both XML-style tags and JSON blocks
  static parseToolCalls(content: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    
    // Debug: log if content contains tool_use tags
    if (content.includes('<tool_use>')) {
      console.log('[ToolParser] Found <tool_use> tags in content');
    }
    
    // Pattern 1: XML-style <tool_use> tags - improved to handle multi-line JSON
    const xmlPattern = /<tool_use>\s*([\s\S]*?)\s*<\/tool_use>/g;
    let match;
    
    while ((match = xmlPattern.exec(content)) !== null) {
      try {
        // Clean up the JSON string - handle potential formatting issues
        const jsonStr = match[1].trim();
        console.log('[ToolParser] Attempting to parse tool JSON:', jsonStr);
        const toolData = JSON.parse(jsonStr);
        if (toolData.tool && typeof toolData.tool === 'string') {
          toolCalls.push({
            id: `call_${Math.random().toString(36).substr(2, 9)}`,
            name: toolData.tool,
            arguments: toolData.arguments || {}
          });
          console.log('[ToolParser] Successfully parsed tool call:', toolData.tool);
        }
      } catch (e) {
        console.error('[ToolParser] Failed to parse tool JSON:', e);
        console.error('[ToolParser] JSON string was:', match[1]);
      }
    }

    // Pattern 2: Anthropic-style tool use
    // Looking for patterns like "I'll use the search_files tool..."
    const anthropicPattern = /\{\s*"type"\s*:\s*"tool_use"\s*,\s*"name"\s*:\s*"([^"]+)"\s*,\s*"input"\s*:\s*({[\s\S]*?})\s*\}/g;
    
    while ((match = anthropicPattern.exec(content)) !== null) {
      try {
        const toolName = match[1];
        const toolArgs = JSON.parse(match[2]);
        toolCalls.push({
          id: `call_${Math.random().toString(36).substr(2, 9)}`,
          name: toolName,
          arguments: toolArgs
        });
      } catch (e) {
        console.error('Failed to parse Anthropic tool format:', e);
      }
    }

    // Pattern 3: OpenAI function calling style
    const functionPattern = /\{\s*"function_call"\s*:\s*\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*"([^"]+)"\s*\}\s*\}/g;
    
    while ((match = functionPattern.exec(content)) !== null) {
      try {
        const toolName = match[1];
        const toolArgs = JSON.parse(match[2]);
        toolCalls.push({
          id: `call_${Math.random().toString(36).substr(2, 9)}`,
          name: toolName,
          arguments: toolArgs
        });
      } catch (e) {
        console.error('Failed to parse OpenAI function call:', e);
      }
    }

    console.log(`[ToolParser] Found ${toolCalls.length} tool calls in content`);
    return toolCalls;
  }

  // Remove tool calls from content to get clean response
  static removeToolCalls(content: string): string {
    // Remove XML-style tool uses
    let cleaned = content.replace(/<tool_use>\s*{[\s\S]*?}\s*<\/tool_use>/g, '');
    
    // Remove Anthropic-style tool uses
    cleaned = cleaned.replace(/\{\s*"type"\s*:\s*"tool_use"[\s\S]*?\}/g, '');
    
    // Remove OpenAI function calls
    cleaned = cleaned.replace(/\{\s*"function_call"\s*:[\s\S]*?\}/g, '');
    
    // Clean up extra whitespace
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
    
    return cleaned;
  }

  // Check if content contains tool calls
  static hasToolCalls(content: string): boolean {
    return this.parseToolCalls(content).length > 0;
  }
}