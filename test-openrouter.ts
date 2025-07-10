import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText, generateText, tool } from 'ai';
import { z } from 'zod';
import fs from 'fs/promises';

async function main() {
  // Load credentials from llms.json
  const credentials = JSON.parse(await fs.readFile('./llms.json', 'utf-8'));
  const openrouterKey = credentials.credentials.openrouter.apiKey;

  // Create OpenRouter client
  const openrouter = createOpenRouter({
    apiKey: openrouterKey,
  });

  console.log('🚀 OpenRouter SDK Test Suite\n');

  // Test 1: Streaming responses
  async function testStreaming() {
    console.log('1️⃣ Testing Streaming Responses...');
    
    const result = await streamText({
      model: openrouter('openai/gpt-4-turbo-preview'),
      messages: [
        { role: 'user', content: 'Count from 1 to 5 slowly, one number per line.' }
      ],
    });

    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
    }
    
    console.log('\n✅ Streaming complete\n');
  }

  // Test 2: Cost metadata and token usage
  async function testMetadata() {
    console.log('2️⃣ Testing Cost Metadata & Token Usage...');
    
    // Test with Vercel AI SDK
    const result = await generateText({
      model: openrouter('openai/gpt-4-turbo-preview'),
      messages: [
        { role: 'user', content: 'Say "Hello, OpenRouter!" and nothing else.' }
      ],
    });

    console.log('Response:', result.text);
    console.log('\nMetadata:');
    console.log('- Usage:', result.usage);
    console.log('- Finish Reason:', result.finishReason);
    console.log('- Response ID:', result.response.id);
    
    // Make a direct API call to see raw OpenRouter response
    console.log('\n📡 Testing Direct API Call...');
    const directResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/tenex/test', // Optional but recommended
        'X-Title': 'OpenRouter Test Suite', // Optional
      },
      body: JSON.stringify({
        model: 'openai/gpt-4-turbo-preview',
        messages: [
          { role: 'user', content: 'Say "Testing direct API" and nothing else.' }
        ],
      }),
    });

    const directData = await directResponse.json();
    console.log('\nDirect API Response:');
    console.log('- ID:', directData.id);
    console.log('- Model:', directData.model);
    console.log('- Usage:', directData.usage);
    
    // Check headers from direct response
    console.log('\nDirect API Headers:');
    console.log('- Rate Limit:', directResponse.headers.get('x-ratelimit-limit'));
    console.log('- Rate Remaining:', directResponse.headers.get('x-ratelimit-remaining'));
    console.log('- Generation Time:', directResponse.headers.get('openrouter-generation-time'));
    
    console.log('\n✅ Metadata test complete\n');
  }

  // Test 3: Native tool calling
  async function testToolCalling() {
    console.log('3️⃣ Testing Native Tool Calling...');
    
    const weatherTool = tool({
      description: 'Get the weather for a location',
      parameters: z.object({
        location: z.string().describe('The location to get weather for'),
        unit: z.enum(['celsius', 'fahrenheit']).optional().default('celsius'),
      }),
      execute: async ({ location, unit }) => {
        // Mock weather data
        return {
          location,
          temperature: Math.floor(Math.random() * 30) + 10,
          unit,
          condition: ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)],
        };
      },
    });

    const result = await generateText({
      model: openrouter('openai/gpt-4-turbo-preview'),
      messages: [
        { role: 'user', content: 'What\'s the weather like in Paris and London?' }
      ],
      tools: {
        weather: weatherTool,
      },
      maxSteps: 5,
    });

    console.log('Final Response:', result.text);
    console.log('\nTool Calls:');
    result.steps.forEach((step, i) => {
      if (step.toolCalls && step.toolCalls.length > 0) {
        console.log(`Step ${i + 1}:`, step.toolCalls);
      }
    });
    
    console.log('\n✅ Tool calling test complete\n');
  }

  // Test 4: Prompt caching
  async function testPromptCaching() {
    console.log('4️⃣ Testing Prompt Caching...');
    
    const systemPrompt = `You are a helpful assistant. This is a long system prompt that should be cached.
    ${Array(50).fill('This line is repeated to make the prompt longer for caching benefits. ').join('')}
    Always respond concisely.`;
    
    // First request - should create cache
    console.log('Making first request (cache miss expected)...');
    const start1 = Date.now();
    const result1 = await generateText({
      model: openrouter('anthropic/claude-3.5-sonnet:beta'),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Say "First request"' }
      ],
    });
    const time1 = Date.now() - start1;
    console.log(`Response 1: ${result1.text} (${time1}ms)`);
    console.log('Usage 1:', result1.usage);
    
    // Second request - should use cache
    console.log('\nMaking second request (cache hit expected)...');
    const start2 = Date.now();
    const result2 = await generateText({
      model: openrouter('anthropic/claude-3.5-sonnet:beta'),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Say "Second request"' }
      ],
    });
    const time2 = Date.now() - start2;
    console.log(`Response 2: ${result2.text} (${time2}ms)`);
    console.log('Usage 2:', result2.usage);
    
    // Third request with same system prompt
    console.log('\nMaking third request (cache hit expected)...');
    const start3 = Date.now();
    const result3 = await generateText({
      model: openrouter('anthropic/claude-3.5-sonnet:beta'),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Say "Third request"' }
      ],
    });
    const time3 = Date.now() - start3;
    console.log(`Response 3: ${result3.text} (${time3}ms)`);
    console.log('Usage 3:', result3.usage);
    
    console.log('\n🔍 Cache Analysis:');
    console.log(`- First request: ${time1}ms`);
    console.log(`- Second request: ${time2}ms (${((1 - time2/time1) * 100).toFixed(1)}% faster)`);
    console.log(`- Third request: ${time3}ms (${((1 - time3/time1) * 100).toFixed(1)}% faster)`);
    
    console.log('\n✅ Prompt caching test complete\n');
  }

  // Test 5: List available models
  async function testListModels() {
    console.log('5️⃣ Fetching Available OpenRouter Models...');
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
        },
      });
      
      const data = await response.json();
      console.log(`\nTotal models available: ${data.data.length}`);
      
      // Show a few popular models
      const popularModels = data.data
        .filter((m: any) => m.id.includes('gpt-4') || m.id.includes('claude'))
        .slice(0, 5);
      
      console.log('\nSample models:');
      popularModels.forEach((model: any) => {
        console.log(`- ${model.id}: $${model.pricing.prompt}/1k tokens`);
      });
    } catch (error) {
      console.error('Error fetching models:', error);
    }
    
    console.log('\n✅ Model listing complete\n');
  }

  // Run all tests
  async function runAllTests() {
    try {
      await testStreaming();
      await testMetadata();
      await testToolCalling();
      await testPromptCaching();
      await testListModels();
      
      console.log('🎉 All tests completed successfully!');
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }

  // Execute tests
  await runAllTests();
}

// Run the main function
main().catch(console.error);