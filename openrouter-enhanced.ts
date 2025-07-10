import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText, generateText } from 'ai';
import fs from 'fs/promises';

// Enhanced OpenRouter client with cost tracking
class OpenRouterClient {
  private openrouter: any;
  private apiKey: string;
  private totalCost: number = 0;
  private modelPricing: Map<string, { prompt: number; completion: number }> = new Map();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.openrouter = createOpenRouter({ apiKey });
  }

  async loadModelPricing() {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });
    const data = await response.json();
    
    data.data.forEach((model: any) => {
      this.modelPricing.set(model.id, {
        prompt: parseFloat(model.pricing.prompt),
        completion: parseFloat(model.pricing.completion),
      });
    });
  }

  calculateCost(modelId: string, usage: { promptTokens: number; completionTokens: number }) {
    const pricing = this.modelPricing.get(modelId);
    if (!pricing) return 0;

    const promptCost = (usage.promptTokens / 1000) * pricing.prompt;
    const completionCost = (usage.completionTokens / 1000) * pricing.completion;
    return promptCost + completionCost;
  }

  async streamWithCost(config: any) {
    const modelId = config.model._modelId || config.model.modelId;
    const result = await streamText({
      ...config,
      model: this.openrouter(modelId),
    });

    // Collect the stream and calculate cost
    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
      process.stdout.write(chunk);
    }

    // Get final usage
    const usage = await result.usage;
    const cost = this.calculateCost(modelId, usage);
    this.totalCost += cost;

    return {
      text: fullText,
      usage,
      cost,
      totalCost: this.totalCost,
    };
  }

  async generateWithCost(config: any) {
    const modelId = config.model._modelId || config.model.modelId;
    const result = await generateText({
      ...config,
      model: this.openrouter(modelId),
    });

    const cost = this.calculateCost(modelId, result.usage);
    this.totalCost += cost;

    return {
      ...result,
      cost,
      totalCost: this.totalCost,
      modelId,
    };
  }

  getTotalCost() {
    return this.totalCost;
  }

  model(modelId: string) {
    return this.openrouter(modelId);
  }
}

// Main demonstration
async function main() {
  // Load credentials
  const credentials = JSON.parse(await fs.readFile('./llms.json', 'utf-8'));
  const client = new OpenRouterClient(credentials.credentials.openrouter.apiKey);
  
  console.log('🚀 Enhanced OpenRouter Client Demo\n');
  
  // Load model pricing
  console.log('📊 Loading model pricing...');
  await client.loadModelPricing();
  console.log('✅ Model pricing loaded\n');

  // Test 1: Stream with cost tracking
  console.log('1️⃣ Streaming with Cost Tracking...');
  const streamResult = await client.streamWithCost({
    model: { _modelId: 'openai/gpt-4-turbo-preview' },
    messages: [
      { role: 'user', content: 'Write a haiku about coding' }
    ],
  });
  console.log(`\n💰 Cost: $${streamResult.cost.toFixed(6)}`);
  console.log(`📊 Total cost so far: $${streamResult.totalCost.toFixed(6)}\n`);

  // Test 2: Different models with cost comparison
  console.log('2️⃣ Cost Comparison Across Models...\n');
  const testPrompt = 'Explain quantum computing in one sentence.';
  
  const models = [
    'openai/gpt-4-turbo-preview',
    'openai/gpt-3.5-turbo',
    'anthropic/claude-3.5-sonnet:beta',
    'google/gemini-pro',
    'meta-llama/llama-3.1-70b-instruct',
  ];

  for (const modelId of models) {
    try {
      console.log(`Testing ${modelId}...`);
      const result = await client.generateWithCost({
        model: { _modelId: modelId },
        messages: [{ role: 'user', content: testPrompt }],
      });
      
      console.log(`Response: ${result.text}`);
      console.log(`Tokens: ${result.usage.totalTokens} (${result.usage.promptTokens}+${result.usage.completionTokens})`);
      console.log(`💰 Cost: $${result.cost.toFixed(6)}\n`);
    } catch (error: any) {
      console.log(`❌ Error with ${modelId}: ${error.message}\n`);
    }
  }

  console.log(`📊 Total cost for all requests: $${client.getTotalCost().toFixed(6)}\n`);

  // Test 3: Prompt caching with Anthropic models
  console.log('3️⃣ Testing Prompt Caching (Anthropic models support this)...\n');
  
  const longSystemPrompt = `You are an expert assistant with deep knowledge in many fields.
  ${Array(100).fill('This is additional context to make the prompt longer. ').join('')}
  Always be helpful and concise.`;

  // First request - cache miss
  console.log('First request (cache miss expected)...');
  const start1 = Date.now();
  const cache1 = await client.generateWithCost({
    model: { _modelId: 'anthropic/claude-3.5-sonnet:beta' },
    messages: [
      { role: 'system', content: longSystemPrompt },
      { role: 'user', content: 'Say "First"' }
    ],
  });
  const time1 = Date.now() - start1;
  console.log(`Response: ${cache1.text}`);
  console.log(`Time: ${time1}ms, Cost: $${cache1.cost.toFixed(6)}`);
  console.log(`Tokens: ${cache1.usage.promptTokens} prompt + ${cache1.usage.completionTokens} completion\n`);

  // Second request - cache hit
  console.log('Second request (cache hit expected)...');
  const start2 = Date.now();
  const cache2 = await client.generateWithCost({
    model: { _modelId: 'anthropic/claude-3.5-sonnet:beta' },
    messages: [
      { role: 'system', content: longSystemPrompt },
      { role: 'user', content: 'Say "Second"' }
    ],
  });
  const time2 = Date.now() - start2;
  console.log(`Response: ${cache2.text}`);
  console.log(`Time: ${time2}ms, Cost: $${cache2.cost.toFixed(6)}`);
  console.log(`Tokens: ${cache2.usage.promptTokens} prompt + ${cache2.usage.completionTokens} completion`);
  console.log(`⚡ Speedup: ${((1 - time2/time1) * 100).toFixed(1)}%\n`);

  console.log(`🎯 Final total cost: $${client.getTotalCost().toFixed(6)}`);
}

// Run the demo
main().catch(console.error);