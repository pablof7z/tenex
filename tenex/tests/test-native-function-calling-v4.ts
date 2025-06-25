import { igniteEngine, loadModels, Message, Plugin, PluginExecutionContext } from 'multi-llm-ts';

// Create plugins using the v4.0 API
class WeatherPlugin extends Plugin {
  getName(): string {
    return 'get_weather';
  }

  getDescription(): string {
    return 'Get the current weather in a given location';
  }

  getParameters(): any {
    return {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city and state, e.g. San Francisco, CA'
        }
      },
      required: ['location']
    };
  }

  async execute(context: PluginExecutionContext, parameters: any): Promise<any> {
    console.log('Weather plugin called with:', parameters);
    console.log('Context:', context);
    return {
      location: parameters.location,
      temperature: 72,
      conditions: 'Sunny',
      timestamp: new Date().toISOString()
    };
  }
}

class CalculatorPlugin extends Plugin {
  getName(): string {
    return 'calculator';
  }

  getDescription(): string {
    return 'Perform mathematical calculations';
  }

  getParameters(): any {
    return {
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
    };
  }

  async execute(context: PluginExecutionContext, parameters: any): Promise<any> {
    console.log('Calculator plugin called with:', parameters);
    const { operation, a, b } = parameters;
    
    switch (operation) {
      case 'add': return { result: a + b };
      case 'subtract': return { result: a - b };
      case 'multiply': return { result: a * b };
      case 'divide': return { result: b !== 0 ? a / b : 'Error: Division by zero' };
      default: return { error: 'Unknown operation' };
    }
  }
}

async function testNativeFunctionCallingV4() {
  const apiKey = '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';
  
  // Test different models via OpenRouter
  const modelsToTest = [
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o-mini (OpenAI)' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Anthropic)' },
    { id: 'google/gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Google)' }
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

      // Add plugins using the v4.0 API
      llm.addPlugin(new WeatherPlugin());
      llm.addPlugin(new CalculatorPlugin());

      // Load models
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
        new Message('system', 'You are a helpful assistant with access to weather and calculator functions.'),
        new Message('user', 'What\'s the weather in San Francisco and what is 25 * 4?')
      ];

      console.log('\nGenerating response with plugins...');
      
      // Use generate method to get streaming response
      const stream = await llm.generate(model, messages);
      
      let fullResponse = '';
      const toolCalls: any[] = [];
      
      for await (const chunk of stream) {
        if (chunk.type === 'tool') {
          console.log('\nTool call detected:', chunk);
          toolCalls.push(chunk);
        } else if (chunk.type === 'content' && chunk.text) {
          fullResponse += chunk.text;
          process.stdout.write(chunk.text);
        }
      }

      console.log('\n\nFull response received');
      console.log('Total tool calls:', toolCalls.length);
      
      if (toolCalls.length > 0) {
        console.log(`✅ ${modelInfo.name} supports native function calling!`);
        
        // Tool calls are automatically executed by multi-llm-ts
        for (const toolCall of toolCalls) {
          console.log(`Tool ${toolCall.name} was called with params:`, toolCall.params);
          console.log(`Result:`, toolCall.result);
        }
      } else {
        console.log(`❌ ${modelInfo.name} did not use native function calling`);
      }

    } catch (error) {
      console.error(`Error testing ${modelInfo.name}:`, error);
    }
  }
}

// Run the test
testNativeFunctionCallingV4().catch(console.error);