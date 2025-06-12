import { Agent } from '../Agent';
import { ToolRegistry } from './ToolRegistry';
import { exampleTools } from './examples';
import type { ToolDefinition } from './types';

// Example of how to create and use tools with an agent
export async function setupAgentWithTools() {
  // Create a tool registry
  const toolRegistry = new ToolRegistry();
  
  // Register example tools
  for (const tool of exampleTools) {
    toolRegistry.register(tool);
  }
  
  // You can also create custom tools
  const customTool: ToolDefinition = {
    name: 'calculate',
    description: 'Perform basic arithmetic calculations',
    parameters: [
      {
        name: 'expression',
        type: 'string',
        description: 'The arithmetic expression to evaluate (e.g., "2 + 2")',
        required: true
      }
    ],
    execute: async (params) => {
      try {
        // Simple evaluation (in production, use a safe math parser)
        const result = eval(params.expression);
        return {
          success: true,
          output: `${params.expression} = ${result}`
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: 'Invalid expression'
        };
      }
    }
  };
  
  toolRegistry.register(customTool);
  
  // Create an agent with the tool registry
  const agent = new Agent(
    'assistant',
    'nsec1...',
    {
      name: 'assistant',
      role: 'A helpful AI assistant with access to various tools',
      description: 'I can help with file operations, calculations, and more'
    },
    undefined, // storage
    'example-project',
    toolRegistry
  );
  
  return { agent, toolRegistry };
}

// Example of using the tool system in a conversation
export async function demonstrateToolUsage() {
  const { agent, toolRegistry } = await setupAgentWithTools();
  
  // Set up LLM config
  agent.setDefaultLLMConfig({
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    apiKey: process.env.ANTHROPIC_API_KEY!,
    maxTokens: 4096
  });
  
  // Create a conversation
  const conversation = await agent.createConversation('example-conv-1');
  
  // Add a user message that would trigger tool use
  conversation.addMessage({
    role: 'user',
    content: 'Can you read the contents of package.json and tell me what version it is?'
  });
  
  // Generate response - the agent will automatically use the read_file tool
  const response = await agent.generateResponse('example-conv-1');
  
  console.log('Agent response:', response.content);
  
  // The agent's response will include the tool call and the file contents
  
  // Another example with calculation
  conversation.addMessage({
    role: 'user',
    content: 'What is 123 * 456?'
  });
  
  const response2 = await agent.generateResponse('example-conv-1');
  console.log('Agent response:', response2.content);
}

// Example of programmatically checking for tool usage
export function analyzeToolUsage(content: string) {
  const { ToolParser } = require('./ToolParser');
  
  const toolCalls = ToolParser.parseToolCalls(content);
  
  if (toolCalls.length > 0) {
    console.log('Found tool calls:');
    for (const call of toolCalls) {
      console.log(`- ${call.name}(${JSON.stringify(call.arguments)})`);
    }
  } else {
    console.log('No tool calls found in the response');
  }
  
  // Get the clean response without tool call markup
  const cleanContent = ToolParser.removeToolCalls(content);
  console.log('Clean content:', cleanContent);
}