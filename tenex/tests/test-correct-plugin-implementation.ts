import { igniteEngine, loadModels, Message, Plugin, PluginExecutionContext, PluginParameter } from 'multi-llm-ts';

// Correct plugin implementation based on the library's interface
class WeatherPlugin extends Plugin {
  serializeInTools(): boolean {
    return true; // This should be included in tools
  }

  isEnabled(): boolean {
    return true;
  }

  getName(): string {
    return 'get_weather';
  }

  getDescription(): string {
    return 'Get the current weather in a given location';
  }

  getPreparationDescription(tool: string): string {
    return 'Checking weather data...';
  }

  getRunningDescription(tool: string, args: any): string {
    return `Getting weather for ${args.location}...`;
  }

  getCompletedDescription(tool: string, args: any, results: any): string | undefined {
    return `Weather retrieved for ${args.location}`;
  }

  getParameters(): PluginParameter[] {
    // PluginParameter is actually LlmToolParameterOpenAI
    return [
      {
        name: 'location',
        type: 'string',
        description: 'The city and state, e.g. San Francisco, CA',
        required: true
      }
    ];
  }

  async execute(context: PluginExecutionContext, parameters: any): Promise<any> {
    console.log('🌤️  Weather plugin executed!');
    console.log('   Model:', context.model);
    console.log('   Parameters:', parameters);
    
    return {
      location: parameters.location,
      temperature: 72,
      conditions: 'Sunny',
      humidity: 65,
      windSpeed: '10 mph'
    };
  }
}

class CalculatorPlugin extends Plugin {
  serializeInTools(): boolean {
    return true;
  }

  isEnabled(): boolean {
    return true;
  }

  getName(): string {
    return 'calculator';
  }

  getDescription(): string {
    return 'Perform basic mathematical calculations';
  }

  getPreparationDescription(tool: string): string {
    return 'Preparing calculation...';
  }

  getRunningDescription(tool: string, args: any): string {
    return `Calculating ${args.operation} of ${args.a} and ${args.b}...`;
  }

  getCompletedDescription(tool: string, args: any, results: any): string | undefined {
    return `Calculation complete: ${results.result}`;
  }

  getParameters(): PluginParameter[] {
    return [
      {
        name: 'operation',
        type: 'string',
        description: 'The operation to perform (add, subtract, multiply, divide)',
        required: true,
        enum: ['add', 'subtract', 'multiply', 'divide']
      },
      {
        name: 'a',
        type: 'number',
        description: 'First number',
        required: true
      },
      {
        name: 'b',
        type: 'number',
        description: 'Second number',
        required: true
      }
    ];
  }

  async execute(context: PluginExecutionContext, parameters: any): Promise<any> {
    console.log('🧮 Calculator plugin executed!');
    console.log('   Model:', context.model);
    console.log('   Parameters:', parameters);
    
    const { operation, a, b } = parameters;
    
    let result: number;
    switch (operation) {
      case 'add': result = a + b; break;
      case 'subtract': result = a - b; break;
      case 'multiply': result = a * b; break;
      case 'divide': result = b !== 0 ? a / b : NaN; break;
      default: throw new Error(`Unknown operation: ${operation}`);
    }
    
    return { result, operation, a, b };
  }
}

async function testCorrectPluginImplementation() {
  const apiKey = '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';
  
  // Test with models that support tools
  const modelsToTest = [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'google/gemini-2.0-flash-001'
  ];

  const llmConfig = { 
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1'
  };

  console.log('Loading models...');
  const models = await loadModels('openrouter', llmConfig);
  
  for (const modelId of modelsToTest) {
    const model = models.chat.find(m => {
      const id = typeof m === 'string' ? m : m.id;
      return id === modelId;
    });
    
    if (!model || typeof model === 'string') {
      console.log(`\n❌ Model ${modelId} not found or has no metadata`);
      continue;
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${model.name} (${model.id})`);
    console.log(`Capabilities:`, model.capabilities);
    console.log('='.repeat(60));

    try {
      const llm = igniteEngine('openrouter', llmConfig);
      
      // Add plugins before making requests
      const weatherPlugin = new WeatherPlugin();
      const calcPlugin = new CalculatorPlugin();
      
      llm.addPlugin(weatherPlugin);
      llm.addPlugin(calcPlugin);

      const messages = [
        new Message('system', 'You are a helpful assistant. Use the available tools to answer questions. When asked about weather, use get_weather. When asked to calculate, use calculator.'),
        new Message('user', 'What is the weather in San Francisco? Also, what is 42 multiplied by 17?')
      ];

      console.log('\nUsing generate() method for streaming...');
      
      const stream = await llm.generate(model, messages);
      
      let response = '';
      const toolCalls: any[] = [];
      
      for await (const chunk of stream) {
        if (chunk.type === 'tool') {
          console.log('\n🎯 Tool chunk received:', chunk);
          toolCalls.push(chunk);
        } else if (chunk.type === 'content' && chunk.text) {
          response += chunk.text;
          process.stdout.write(chunk.text);
        }
      }
      
      console.log('\n\nStreaming complete.');
      console.log(`Tool calls detected: ${toolCalls.length}`);
      
      if (toolCalls.length === 0) {
        console.log('\nAlso trying complete() method...');
        
        const completeResponse = await llm.complete(model, messages);
        console.log('Complete response:', {
          hasContent: !!completeResponse.content,
          contentLength: completeResponse.content?.length || 0,
          toolCalls: completeResponse.toolCalls?.length || 0
        });
        
        if (completeResponse.toolCalls && completeResponse.toolCalls.length > 0) {
          console.log('✅ Tool calls found in complete() response!');
          completeResponse.toolCalls.forEach((tc, i) => {
            console.log(`  Tool ${i + 1}: ${tc.name}`);
            console.log(`    Params:`, tc.params);
          });
        }
      }
      
    } catch (error) {
      console.error(`Error testing ${modelId}:`, error);
    }
  }
}

testCorrectPluginImplementation().catch(console.error);