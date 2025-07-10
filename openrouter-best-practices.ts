import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText, generateText, tool } from 'ai';
import { z } from 'zod';
import fs from 'fs/promises';

/**
 * Best practices for using OpenRouter with TypeScript
 * 
 * Key features demonstrated:
 * 1. Streaming responses with proper error handling
 * 2. Cost tracking and optimization
 * 3. Native tool calling
 * 4. Model selection based on task requirements
 * 5. Rate limiting and retry logic
 */

interface ModelConfig {
  id: string;
  contextLength: number;
  costPer1kPrompt: number;
  costPer1kCompletion: number;
  capabilities: string[];
}

class OpenRouterService {
  private client: any;
  private apiKey: string;
  private models: Map<string, ModelConfig> = new Map();
  private totalCost: number = 0;
  private requestCount: number = 0;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = createOpenRouter({ apiKey });
  }

  async initialize() {
    await this.loadModelConfigs();
  }

  private async loadModelConfigs() {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });
    const data = await response.json();
    
    data.data.forEach((model: any) => {
      this.models.set(model.id, {
        id: model.id,
        contextLength: model.context_length || 4096,
        costPer1kPrompt: parseFloat(model.pricing.prompt),
        costPer1kCompletion: parseFloat(model.pricing.completion),
        capabilities: model.capabilities || [],
      });
    });
  }

  selectBestModel(requirements: {
    maxCost?: number;
    minContextLength?: number;
    needsTools?: boolean;
    preferredVendor?: string;
  }): string {
    let bestModel = 'openai/gpt-4-turbo-preview'; // default
    let lowestCost = Infinity;

    for (const [id, config] of this.models) {
      // Skip if doesn't meet requirements
      if (requirements.minContextLength && config.contextLength < requirements.minContextLength) continue;
      if (requirements.preferredVendor && !id.startsWith(requirements.preferredVendor)) continue;
      if (requirements.needsTools && !config.capabilities.includes('tools')) continue;
      
      const avgCost = (config.costPer1kPrompt + config.costPer1kCompletion) / 2;
      if (requirements.maxCost && avgCost > requirements.maxCost) continue;
      
      if (avgCost < lowestCost) {
        lowestCost = avgCost;
        bestModel = id;
      }
    }

    return bestModel;
  }

  private calculateCost(modelId: string, usage: any): number {
    const config = this.models.get(modelId);
    if (!config) return 0;

    const promptCost = (usage.promptTokens / 1000) * config.costPer1kPrompt;
    const completionCost = (usage.completionTokens / 1000) * config.costPer1kCompletion;
    return promptCost + completionCost;
  }

  async streamCompletion(params: {
    model?: string;
    messages: any[];
    onChunk?: (chunk: string) => void;
    maxRetries?: number;
  }) {
    const modelId = params.model || this.selectBestModel({});
    let retries = 0;
    const maxRetries = params.maxRetries || 3;

    while (retries < maxRetries) {
      try {
        const result = await streamText({
          model: this.client(modelId),
          messages: params.messages,
        });

        let fullText = '';
        let chunkCount = 0;

        for await (const chunk of result.textStream) {
          fullText += chunk;
          chunkCount++;
          if (params.onChunk) {
            params.onChunk(chunk);
          }
        }

        const usage = await result.usage;
        const cost = this.calculateCost(modelId, usage);
        this.totalCost += cost;
        this.requestCount++;

        return {
          text: fullText,
          usage,
          cost,
          modelId,
          chunkCount,
          stats: this.getStats(),
        };
      } catch (error: any) {
        retries++;
        if (retries >= maxRetries) throw error;
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
        console.warn(`Retry ${retries}/${maxRetries} after error:`, error.message);
      }
    }

    throw new Error('Max retries exceeded');
  }

  async generateCompletion(params: {
    model?: string;
    messages: any[];
    tools?: any;
    maxSteps?: number;
  }) {
    const modelId = params.model || this.selectBestModel({ needsTools: !!params.tools });
    
    const result = await generateText({
      model: this.client(modelId),
      messages: params.messages,
      tools: params.tools,
      maxSteps: params.maxSteps,
    });

    const cost = this.calculateCost(modelId, result.usage);
    this.totalCost += cost;
    this.requestCount++;

    return {
      ...result,
      cost,
      modelId,
      stats: this.getStats(),
    };
  }

  getStats() {
    return {
      totalCost: this.totalCost,
      requestCount: this.requestCount,
      avgCostPerRequest: this.requestCount > 0 ? this.totalCost / this.requestCount : 0,
    };
  }

  getModelInfo(modelId: string) {
    return this.models.get(modelId);
  }

  listModels(filter?: (config: ModelConfig) => boolean) {
    const models = Array.from(this.models.values());
    return filter ? models.filter(filter) : models;
  }
}

// Demonstration
async function main() {
  const credentials = JSON.parse(await fs.readFile('./llms.json', 'utf-8'));
  const service = new OpenRouterService(credentials.credentials.openrouter.apiKey);
  
  console.log('🚀 OpenRouter Best Practices Demo\n');
  
  await service.initialize();
  console.log('✅ Service initialized\n');

  // 1. Smart model selection
  console.log('1️⃣ Smart Model Selection');
  
  const cheapModel = service.selectBestModel({ maxCost: 0.001 });
  const toolModel = service.selectBestModel({ needsTools: true });
  const longContextModel = service.selectBestModel({ minContextLength: 100000 });
  
  console.log(`Cheapest model: ${cheapModel}`);
  console.log(`Best tool model: ${toolModel}`);
  console.log(`Long context model: ${longContextModel}\n`);

  // 2. Streaming with progress tracking
  console.log('2️⃣ Streaming with Progress Tracking');
  let charCount = 0;
  const streamResult = await service.streamCompletion({
    messages: [{ role: 'user', content: 'Write a short story about AI (3 sentences)' }],
    onChunk: (chunk) => {
      charCount += chunk.length;
      process.stdout.write(chunk);
    },
  });
  console.log(`\n\n📊 Stream stats: ${streamResult.chunkCount} chunks, ${charCount} chars`);
  console.log(`💰 Cost: $${streamResult.cost.toFixed(6)} (${streamResult.modelId})\n`);

  // 3. Tool calling with cost optimization
  console.log('3️⃣ Tool Calling with Cost Optimization');
  
  const calculateTool = tool({
    description: 'Calculate mathematical expressions',
    parameters: z.object({
      expression: z.string(),
    }),
    execute: async ({ expression }) => {
      return { result: eval(expression) }; // Note: eval is unsafe in production!
    },
  });

  const toolResult = await service.generateCompletion({
    model: service.selectBestModel({ needsTools: true, maxCost: 0.01 }),
    messages: [
      { role: 'user', content: 'What is 25 * 4 + 10?' }
    ],
    tools: { calculate: calculateTool },
    maxSteps: 3,
  });

  console.log(`Result: ${toolResult.text}`);
  console.log(`💰 Cost: $${toolResult.cost.toFixed(6)} (${toolResult.modelId})`);
  console.log(`Steps: ${toolResult.steps.length}\n`);

  // 4. Cost comparison for different tasks
  console.log('4️⃣ Cost Optimization Analysis');
  
  const tasks = [
    { prompt: 'Say hi', type: 'simple' },
    { prompt: 'Write a 100-word essay on AI', type: 'medium' },
    { prompt: 'Analyze this code:\n```\nfunction fibonacci(n) { return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2); }\n```', type: 'complex' },
  ];

  for (const task of tasks) {
    console.log(`\nTask: ${task.type}`);
    
    // Try with cheap model
    const cheapResult = await service.generateCompletion({
      model: service.selectBestModel({ maxCost: 0.001 }),
      messages: [{ role: 'user', content: task.prompt }],
    });
    
    // Try with premium model
    const premiumResult = await service.generateCompletion({
      model: 'openai/gpt-4-turbo-preview',
      messages: [{ role: 'user', content: task.prompt }],
    });
    
    console.log(`Cheap model (${cheapResult.modelId}): $${cheapResult.cost.toFixed(6)}`);
    console.log(`Premium model (${premiumResult.modelId}): $${premiumResult.cost.toFixed(6)}`);
    console.log(`Savings: $${(premiumResult.cost - cheapResult.cost).toFixed(6)} (${((1 - cheapResult.cost/premiumResult.cost) * 100).toFixed(1)}%)`);
  }

  // 5. Final statistics
  console.log('\n📊 Session Statistics:');
  const stats = service.getStats();
  console.log(`Total requests: ${stats.requestCount}`);
  console.log(`Total cost: $${stats.totalCost.toFixed(6)}`);
  console.log(`Average cost per request: $${stats.avgCostPerRequest.toFixed(6)}`);
  
  // 6. Model catalog
  console.log('\n📚 Available Models by Price (sample):');
  const affordableModels = service.listModels(m => m.costPer1kPrompt < 0.001)
    .sort((a, b) => a.costPer1kPrompt - b.costPer1kPrompt)
    .slice(0, 5);
    
  affordableModels.forEach(model => {
    console.log(`- ${model.id}: $${model.costPer1kPrompt}/1k prompt tokens`);
  });
}

main().catch(console.error);