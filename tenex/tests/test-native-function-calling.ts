import { igniteEngine, loadModels, Message, Model, LlmTool } from 'multi-llm-ts';

// Define tools using multi-llm-ts format
const weatherTool: LlmTool = {
  name: 'weather',
  description: 'Get weather information for a location',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'The city and state, e.g. San Francisco, CA'
      }
    },
    required: ['location']
  },
  execute: async (params: any) => {
    console.log('Weather tool called with:', params);
    const { location } = params;
    return {
      location,
      temperature: 72,
      conditions: 'Sunny',
      timestamp: new Date().toISOString()
    };
  }
};

const calculatorTool: LlmTool = {
  name: 'calculator',
  description: 'Perform mathematical calculations',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['add', 'subtract', 'multiply', 'divide'],
        description: 'The mathematical operation to perform'
      },
      a: {
        type: 'number',
        description: 'First operand'
      },
      b: {
        type: 'number',
        description: 'Second operand'
      }
    },
    required: ['operation', 'a', 'b']
  },
  execute: async (params: any) => {
    console.log('Calculator tool called with:', params);
    const { operation, a, b } = params;
    
    switch (operation) {
      case 'add': return { result: a + b };
      case 'subtract': return { result: a - b };
      case 'multiply': return { result: a * b };
      case 'divide': return { result: b !== 0 ? a / b : 'Error: Division by zero' };
      default: return { error: 'Unknown operation' };
    }
  }
};

async function testNativeFunctionCalling() {
  const apiKey = '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';
  
  // Test different models via OpenRouter
  const modelsToTest = [
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o-mini (OpenAI)' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Anthropic)' },
    { id: 'google/gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Google)' },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat' }
  ];

  for (const modelInfo of modelsToTest) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing ${modelInfo.name}`);
    console.log('='.repeat(60));

    try {
      // Initialize engine with OpenRouter
      const llmConfig = { 
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1'
      };
      const llm = igniteEngine('openrouter', llmConfig);

      // Load models to get proper model objects
      const models = await loadModels('openrouter', llmConfig);
      
      if (!models || !models.chat || models.chat.length === 0) {
        console.log(`No models available for ${modelInfo.name}`);
        continue;
      }
      
      // Find the specific model
      const model = models.chat.find(m => {
        const modelId = typeof m === 'string' ? m : m.id;
        return modelId === modelInfo.id;
      });
      
      if (!model) {
        console.log(`Model ${modelInfo.id} not found in available models`);
        continue;
      }

      // Create conversation
      const messages = [
        new Message('system', 'You are a helpful assistant that can check weather and perform calculations.'),
        new Message('user', 'What\'s the weather in San Francisco and what is 25 * 4?')
      ];

      console.log('\nSending request...');
      
      // Generate response with tools
      const tools = [weatherTool, calculatorTool];
      
      console.log('Testing with complete method...');
      console.log('Tools being sent:', tools.map(t => ({ name: t.name, description: t.description })));
      
      try {
        const response = await llm.complete(model, messages, {
          tools,
          usage: true,
          temperature: 0.1,
          tool_choice: 'auto' // Try to force tool usage
        });
        
        console.log('\nComplete response:', JSON.stringify(response, null, 2));
        console.log('Has tool calls:', !!response.toolCalls);
        console.log('Tool calls count:', response.toolCalls?.length || 0);
        
        if (response.toolCalls && response.toolCalls.length > 0) {
          console.log(`✅ ${modelInfo.name} supports native function calling!`);
          
          // Execute the tool calls
          for (const toolCall of response.toolCalls) {
            const tool = tools.find(t => t.name === toolCall.name);
            if (tool) {
              const result = await tool.execute(toolCall.params);
              console.log(`Tool ${toolCall.name} result:`, result);
            }
          }
        } else {
          console.log(`❌ ${modelInfo.name} did not use native function calling`);
          console.log('Response content:', response.content);
        }
      } catch (completeError) {
        console.log('Complete method failed:', completeError);
        console.log('\nTrying generate method...');
        
        // Try with generate method
        const stream = await llm.generate(model, messages);
        
        let fullResponse = '';
        const toolCalls: any[] = [];
        
        for await (const chunk of stream) {
          if (chunk.type === 'tool') {
            console.log('\nTool call detected:', chunk);
            toolCalls.push(chunk);
          } else if (chunk.type === 'content' && chunk.text) {
            fullResponse += chunk.text;
          }
        }

        console.log('\nFull response:', fullResponse);
        console.log('\nTotal tool calls:', toolCalls.length);
        
        // Test if native function calling worked
        if (toolCalls.length > 0) {
          console.log(`✅ ${modelInfo.name} supports native function calling via generate!`);
        } else {
          console.log(`❌ ${modelInfo.name} did not use native function calling`);
        }
      }

    } catch (error) {
      console.error(`Error testing ${modelInfo.name}:`, error);
    }
  }
}

// Run the test
testNativeFunctionCalling().catch(console.error);