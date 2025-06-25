import { igniteEngine, loadModels, Message, LlmTool } from 'multi-llm-ts';

// Define tools
const weatherTool: LlmTool = {
  name: 'get_weather',
  description: 'Get the current weather in a given location',
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
    return {
      location: params.location,
      temperature: 72,
      conditions: 'Sunny'
    };
  }
};

async function testDirectOpenAI() {
  console.log('Testing direct OpenAI function calling...\n');
  
  // First, let's try with OpenRouter using GPT-4
  const openrouterConfig = {
    apiKey: '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',
    baseURL: 'https://openrouter.ai/api/v1'
  };
  
  const llm = igniteEngine('openrouter', openrouterConfig);
  const models = await loadModels('openrouter', openrouterConfig);
  
  // Find GPT-4 model
  const gpt4Model = models.chat.find(m => {
    const modelId = typeof m === 'string' ? m : m.id;
    return modelId.includes('gpt-4') && !modelId.includes('vision');
  });
  
  if (!gpt4Model) {
    console.log('GPT-4 model not found');
    return;
  }
  
  console.log('Using model:', typeof gpt4Model === 'string' ? gpt4Model : gpt4Model.id);
  
  const messages = [
    new Message('system', 'You are a helpful assistant with access to weather information. Use the get_weather function to answer questions about weather.'),
    new Message('user', 'What is the weather like in San Francisco?')
  ];
  
  try {
    // Try with explicit function calling
    const response = await llm.complete(gpt4Model, messages, {
      tools: [weatherTool],
      tool_choice: { type: 'function', function: { name: 'get_weather' } }, // Force function use
      usage: true
    });
    
    console.log('\nResponse:', JSON.stringify(response, null, 2));
    
    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log('\n✅ Function calling worked!');
      
      // Execute the function
      for (const toolCall of response.toolCalls) {
        const result = await weatherTool.execute(toolCall.params);
        console.log(`Function ${toolCall.name} returned:`, result);
      }
    } else {
      console.log('\n❌ No function calls detected');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testDirectOpenAI().catch(console.error);