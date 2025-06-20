import { logger } from "@tenex/shared";
import { ToolDetector } from "./ToolDetector";
import { ShellExecutor, FileExecutor } from "./executors";
import type { 
  ToolExecutor, 
  ToolInvocation, 
  ToolExecutionContext, 
  ToolExecutionResult 
} from "./types";

export class ToolExecutionManager {
  private detector = new ToolDetector();
  private executors: Map<string, ToolExecutor> = new Map();
  
  constructor() {
    // Register default executors
    this.registerExecutor(new ShellExecutor());
    this.registerExecutor(new FileExecutor());
  }
  
  /**
   * Register a tool executor
   */
  registerExecutor(executor: ToolExecutor): void {
    this.executors.set(executor.name, executor);
    logger.debug('Registered tool executor', { name: executor.name });
  }
  
  /**
   * Process agent response for tool invocations
   */
  async processResponse(
    response: string,
    context: ToolExecutionContext
  ): Promise<{
    cleanedResponse: string;
    toolResults: ToolExecutionResult[];
    enhancedResponse: string;
  }> {
    // Detect tools in response
    const invocations = this.detector.detectTools(response);
    
    if (invocations.length === 0) {
      return {
        cleanedResponse: response,
        toolResults: [],
        enhancedResponse: response
      };
    }
    
    logger.info('Processing tool invocations', {
      count: invocations.length,
      tools: invocations.map(i => `${i.toolName}:${i.action}`)
    });
    
    // Execute tools
    const results = await this.executeTools(invocations, context);
    
    // Clean response
    const cleanedResponse = this.detector.cleanResponse(response, invocations);
    
    // Enhance response with results
    const enhancedResponse = this.enhanceResponse(cleanedResponse, invocations, results);
    
    return {
      cleanedResponse,
      toolResults: results,
      enhancedResponse
    };
  }
  
  /**
   * Execute multiple tool invocations
   */
  private async executeTools(
    invocations: ToolInvocation[],
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];
    
    for (const invocation of invocations) {
      const executor = this.executors.get(invocation.toolName);
      
      if (!executor) {
        logger.warn('No executor found for tool', { tool: invocation.toolName });
        results.push({
          success: false,
          error: `No executor for tool: ${invocation.toolName}`,
          duration: 0
        });
        continue;
      }
      
      try {
        const result = await executor.execute(invocation, context);
        results.push(result);
      } catch (error) {
        logger.error('Tool execution failed', { error, invocation });
        results.push({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: 0
        });
      }
    }
    
    return results;
  }
  
  /**
   * Enhance response with tool execution results
   */
  private enhanceResponse(
    cleanedResponse: string,
    invocations: ToolInvocation[],
    results: ToolExecutionResult[]
  ): string {
    let enhanced = cleanedResponse;
    
    // Add tool results section if there were executions
    if (results.length > 0) {
      enhanced += '\n\n---\n\n**Tool Execution Results:**\n';
      
      for (let i = 0; i < invocations.length; i++) {
        const invocation = invocations[i];
        const result = results[i];
        
        enhanced += `\n### ${invocation.toolName}:${invocation.action}\n`;
        
        if (result.success) {
          if (typeof result.output === 'string') {
            // Format output in code block if it looks like code or has newlines
            if (result.output.includes('\n') || result.output.length > 80) {
              enhanced += '```\n' + result.output + '\n```\n';
            } else {
              enhanced += result.output + '\n';
            }
          } else {
            enhanced += '```json\n' + JSON.stringify(result.output, null, 2) + '\n```\n';
          }
        } else {
          enhanced += `❌ Error: ${result.error}\n`;
        }
      }
    }
    
    return enhanced;
  }
}