import { igniteEngine, loadModels, Message, Plugin, PluginExecutionContext } from 'multi-llm-ts';

// Create a simple weather plugin
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
    console.log('🌤️  Weather plugin executed!');
    console.log('   Parameters:', parameters);
    console.log('   Context:', context);
    return {
      location: parameters.location,
      temperature: 72,
      conditions: 'Sunny',
      humidity: 65
    };
  }
}

async function testToolSupportedModels() {
  const apiKey = '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';
  
  // Test models that explicitly support tools
  const modelsToTest = [
    'anthropic/claude-3.5-sonnet',
    'google/gemini-2.0-flash-001',
    'openai/gpt-4o',
    'deepseek/deepseek-chat'
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
    
    if (!model) {
      console.log(`\n❌ Model ${modelId} not found`);
      continue;
    }
    
    const modelInfo = typeof model === 'string' ? { id: model } : model;
    const supportsTools = typeof model !== 'string' && model.capabilities?.tools;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${modelId}`);
    console.log(`Supports tools: ${supportsTools ? '✅ YES' : '❌ NO'}`);
    console.log('='.repeat(60));

    try {
      const llm = igniteEngine('openrouter', llmConfig);
      llm.addPlugin(new WeatherPlugin());

      const messages = [
        new Message('system', 'You are a helpful assistant. When asked about weather, use the get_weather function.'),
        new Message('user', 'What is the weather like in San Francisco?')
      ];

      console.log('\nSending request...');
      
      // Try streaming generate
      const stream = await llm.generate(model, messages);
      
      let response = '';
      let toolCallDetected = false;
      
      for await (const chunk of stream) {
        if (chunk.type === 'tool') {
          toolCallDetected = true;
          console.log('\n🎯 Tool call detected!');
          console.log('   Name:', chunk.name);
          console.log('   Params:', chunk.params);
          console.log('   Result:', chunk.result);
        } else if (chunk.type === 'content' && chunk.text) {
          response += chunk.text;
        }
      }
      
      if (!toolCallDetected) {
        console.log('\n📝 Response (no tool calls):');
        console.log(response);
      }
      
    } catch (error) {
      console.error(`Error testing ${modelId}:`, error);
    }
  }
}

testToolSupportedModels().catch(console.error);