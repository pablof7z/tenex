import { logger } from '@/utils/logger';
import { getTool } from './registry';
import type { ToolExecutionContext, ToolExecutionResult, ToolExecutionMetadata } from './types';

// Tool use interface
interface ToolUse {
  tool: string;
  args?: Record<string, unknown>;
}


// Parse JSON tool uses from content
function parseToolUses(content: string): { toolUses: ToolUse[], positions: { start: number, end: number, raw: string }[] } {
  const toolUses: ToolUse[] = [];
  const positions: { start: number, end: number, raw: string }[] = [];
  
  // Pattern to match <tool_use>{...}</tool_use>
  const jsonToolPattern = /<tool_use>(.*?)<\/tool_use>/gs;
  
  let match: RegExpExecArray | null = jsonToolPattern.exec(content);
  while (match !== null) {
    try {
      const jsonContent = match[1]?.trim();
      if (!jsonContent) {
        match = jsonToolPattern.exec(content);
        continue;
      }
      const toolUse = JSON.parse(jsonContent) as ToolUse;
      toolUses.push(toolUse);
      positions.push({
        start: match.index,
        end: match.index + match[0].length,
        raw: match[0]
      });
    } catch (error) {
      logger.warn(`Failed to parse tool use JSON: ${error}`);
    }
    match = jsonToolPattern.exec(content);
  }
  
  return { toolUses, positions };
}

// Execute a single tool use
async function executeSingleTool(toolUse: ToolUse, context: ToolExecutionContext) {
  const { tool: toolName, args = {} } = toolUse;
  
  const tool = getTool(toolName);
  if (!tool) {
    return { success: false, error: `Unknown tool: ${toolName}` };
  }
  
  try {
    return await tool.run(args, context);
  } catch (error: unknown) {
    logger.error(`Tool execution failed for ${toolName}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Tool execution failed' };
  }
}

// Main execution function - JSON format only
export async function executeTools(content: string, context: ToolExecutionContext): Promise<{ processedContent: string; toolResults: ToolExecutionResult[] }> {
  let processedContent = content;
  const toolResults: ToolExecutionResult[] = [];
  
  // First, try to parse and execute JSON tool uses
  const { toolUses, positions } = parseToolUses(content);
  
  // Execute tools in reverse order to maintain correct positions
  for (let i = positions.length - 1; i >= 0; i--) {
    const toolUse = toolUses[i];
    const position = positions[i];
    
    if (toolUse && position) {
      const startTime = Date.now();
      const result = await executeSingleTool(toolUse, context);
      const duration = Date.now() - startTime;
      
      // Create ToolExecutionResult with metadata
      const toolExecutionResult: ToolExecutionResult = {
        success: result.success,
        output: result.output,
        error: result.error,
        duration,
        toolName: toolUse.tool,
        metadata: result.metadata
      };
      
      // Add to beginning since we're processing in reverse
      toolResults.unshift(toolExecutionResult);
      
      const output = result.success ? (result.output || '') : `Error: ${result.error}`;
      
      // Replace the tool use with its output
      processedContent = `${processedContent.substring(0, position.start)}\`\`\`\n${output}\n\`\`\`${processedContent.substring(position.end)}`;
    }
  }
  
  
  return { processedContent, toolResults };
}