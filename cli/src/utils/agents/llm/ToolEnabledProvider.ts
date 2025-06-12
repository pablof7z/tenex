import type { LLMProvider, LLMMessage, LLMResponse, LLMContext } from './types';
import { ToolRegistry } from '../tools/ToolRegistry';
import { ToolParser } from '../tools/ToolParser';
import { ToolExecutor } from '../tools/ToolExecutor';
import type { ToolCall } from '../tools/types';

export class ToolEnabledProvider implements LLMProvider {
  private executor: ToolExecutor;

  constructor(
    private baseProvider: LLMProvider,
    private toolRegistry: ToolRegistry,
    private providerType: 'anthropic' | 'openai' | 'openrouter' = 'anthropic'
  ) {
    this.executor = new ToolExecutor(toolRegistry);
  }

  async generateResponse(
    messages: LLMMessage[],
    config: any,
    context?: LLMContext,
    tools?: any[]
  ): Promise<LLMResponse> {
    // Add tool instructions to the system message if tools are available
    let enhancedMessages = [...messages];
    const availableTools = this.toolRegistry.getAllTools();
    
    if (availableTools.length > 0) {
      const toolPrompt = this.toolRegistry.generateSystemPrompt();
      
      // Find or create system message
      const systemMessageIndex = enhancedMessages.findIndex(m => m.role === 'system');
      if (systemMessageIndex >= 0) {
        enhancedMessages[systemMessageIndex] = {
          ...enhancedMessages[systemMessageIndex],
          content: enhancedMessages[systemMessageIndex].content + '\n\n' + toolPrompt
        };
      } else {
        enhancedMessages.unshift({
          role: 'system',
          content: toolPrompt
        });
      }
    }

    // Convert tools to provider-specific format
    let providerTools: any[] | undefined;
    if (availableTools.length > 0) {
      switch (this.providerType) {
        case 'anthropic':
          providerTools = this.toolRegistry.toAnthropicFormat();
          break;
        case 'openai':
        case 'openrouter':
          providerTools = this.toolRegistry.toOpenAIFormat();
          break;
      }
    }

    // Get initial response
    const response = await this.baseProvider.generateResponse(
      enhancedMessages,
      config,
      context,
      providerTools
    );

    // Check if the response contains tool calls
    const toolCalls = ToolParser.parseToolCalls(response.content);
    
    if (toolCalls.length === 0) {
      // No tool calls, return the response as-is
      return response;
    }

    // Create tool context with typing indicator
    const toolContext = context?.typingIndicator ? {
      updateTypingIndicator: context.typingIndicator
    } : undefined;

    // Execute the tools
    const toolResponses = await this.executor.executeTools(toolCalls, toolContext);
    
    // Remove tool calls from the content
    const cleanedContent = ToolParser.removeToolCalls(response.content);
    
    // Add the assistant's message with tool calls
    enhancedMessages.push({
      role: 'assistant',
      content: cleanedContent,
      tool_calls: toolCalls
    });

    // Add tool responses
    for (const toolResponse of toolResponses) {
      enhancedMessages.push({
        role: 'tool',
        content: toolResponse.output,
        tool_call_id: toolResponse.tool_call_id
      });
    }

    // Get the final response after tool execution
    const finalResponse = await this.baseProvider.generateResponse(
      enhancedMessages,
      config,
      context,
      providerTools
    );

    // Combine usage statistics
    if (response.usage && finalResponse.usage) {
      finalResponse.usage = {
        prompt_tokens: response.usage.prompt_tokens + finalResponse.usage.prompt_tokens,
        completion_tokens: response.usage.completion_tokens + finalResponse.usage.completion_tokens,
        total_tokens: response.usage.total_tokens + finalResponse.usage.total_tokens,
        cache_creation_input_tokens: 
          (response.usage.cache_creation_input_tokens || 0) + 
          (finalResponse.usage.cache_creation_input_tokens || 0),
        cache_read_input_tokens: 
          (response.usage.cache_read_input_tokens || 0) + 
          (finalResponse.usage.cache_read_input_tokens || 0),
        cost: (response.usage.cost || 0) + (finalResponse.usage.cost || 0)
      };
    }

    return finalResponse;
  }
}