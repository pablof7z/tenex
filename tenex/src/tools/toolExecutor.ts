import { logger } from '@/utils/logger';
import { getTool } from './registry';
import type { ToolExecutionContext, ToolExecutionResult, ToolExecutionMetadata, ToolResult } from './types';
import { getToolLogger } from './toolLogger';

// Tool use interface
interface ToolUse {
  tool: string;
  args?: Record<string, unknown>;
}


// Parse JSON tool uses from content
export function parseToolUses(content: string): { toolUses: ToolUse[], positions: { start: number, end: number, raw: string }[] } {
  const toolUses: ToolUse[] = [];
  const positions: { start: number, end: number, raw: string }[] = [];
  
  // Pattern to match <tool_use>{...}</tool_use>
  const jsonToolPattern = /<tool_use>(.*?)<\/tool_use>/gs;
  
  logger.debug('Starting tool parsing', { contentLength: content.length });
  
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
      
      logger.debug('Parsed tool use', {
        tool: toolUse.tool,
        hasArgs: !!toolUse.args,
        position: { start: match.index, end: match.index + match[0].length }
      });
    } catch (error) {
      logger.warn(`Failed to parse tool use JSON: ${error}`);
    }
    match = jsonToolPattern.exec(content);
  }
  
  logger.info('Tool parsing complete', { 
    toolCount: toolUses.length,
    tools: toolUses.map(t => t.tool)
  });
  
  return { toolUses, positions };
}

// Execute a single tool use
async function executeSingleTool(
  toolUse: ToolUse, 
  context: ToolExecutionContext,
  trace?: {
    batchId?: string;
    batchIndex?: number;
    batchSize?: number;
  }
): Promise<ToolResult> {
  const { tool: toolName, args = {} } = toolUse;
  
  logger.info('🔧 Starting tool execution', {
    tool: toolName,
    agent: context.agentName,
    phase: context.phase,
    conversationId: context.conversationId,
    args: Object.keys(args)
  });
  
  const tool = getTool(toolName);
  if (!tool) {
    logger.error('Tool not found', { toolName });
    return { success: false, error: `Unknown tool: ${toolName}` };
  }
  
  const startTime = Date.now();
  const toolLogger = getToolLogger();
  
  try {
    logger.debug(`Executing ${toolName} with args`, { args });
    const result = await tool.run(args, context);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logger.info('✅ Tool execution completed', {
      tool: toolName,
      agent: context.agentName,
      success: result.success,
      duration,
      hasOutput: !!result.output,
      hasMetadata: !!result.metadata,
      outputLength: result.output?.length || 0
    });
    
    // Log to persistent storage
    if (toolLogger) {
      const executionResult: ToolExecutionResult = {
        success: result.success,
        output: result.output,
        error: result.error,
        duration,
        toolName,
        metadata: result.metadata
      };
      
      await toolLogger.logToolCall(
        toolName,
        args,
        context,
        executionResult,
        { startTime, endTime },
        trace
      );
    }
    
    return result;
  } catch (error: unknown) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Tool execution failed';
    
    logger.error(`❌ Tool execution failed for ${toolName}:`, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      agent: context.agentName,
      duration
    });
    
    const result: ToolResult = { success: false, error: errorMessage };
    
    // Log failed execution to persistent storage
    if (toolLogger) {
      const executionResult: ToolExecutionResult = {
        success: result.success,
        output: result.output,
        error: result.error,
        duration,
        toolName,
        metadata: result.metadata
      };
      
      await toolLogger.logToolCall(
        toolName,
        args,
        context,
        executionResult,
        { startTime, endTime },
        trace
      );
    }
    
    return result;
  }
}

// Main execution function - JSON format only
export async function executeTools(content: string, context: ToolExecutionContext): Promise<{ processedContent: string; toolResults: ToolExecutionResult[] }> {
  let processedContent = content;
  const toolResults: ToolExecutionResult[] = [];
  
  logger.info('🔍 Starting tool execution batch', {
    agent: context.agentName,
    phase: context.phase,
    conversationId: context.conversationId
  });
  
  // First, try to parse and execute JSON tool uses
  const { toolUses, positions } = parseToolUses(content);
  
  if (toolUses.length === 0) {
    logger.debug('No tools found in content');
    return { processedContent, toolResults };
  }
  
  logger.info(`📋 Executing ${toolUses.length} tools`, {
    tools: toolUses.map(t => t.tool),
    agent: context.agentName
  });
  
  // Generate a batch ID for this execution
  const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Execute tools in reverse order to maintain correct positions
  for (let i = positions.length - 1; i >= 0; i--) {
    const toolUse = toolUses[i];
    const position = positions[i];
    
    if (toolUse && position) {
      const toolIndex = toolUses.length - i;
      logger.debug(`Executing tool ${toolIndex}/${toolUses.length}`, {
        tool: toolUse.tool,
        agent: context.agentName
      });
      
      const startTime = Date.now();
      const result = await executeSingleTool(toolUse, context, {
        batchId,
        batchIndex: toolIndex,
        batchSize: toolUses.length
      });
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
  
  logger.info('🎯 Tool execution batch completed', {
    agent: context.agentName,
    totalTools: toolUses.length,
    successful: toolResults.filter(r => r.success).length,
    failed: toolResults.filter(r => !r.success).length,
    totalDuration: toolResults.reduce((sum, r) => sum + r.duration, 0)
  });
  
  return { processedContent, toolResults };
}