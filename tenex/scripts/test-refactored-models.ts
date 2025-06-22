#!/usr/bin/env npx tsx

import chalk from "chalk";
import { loadModels } from "multi-llm-ts";

// Test the refactored approach
async function testRefactoredApproach() {
  console.log(chalk.cyan("🧪 Testing refactored model loading approach\n"));

  const PROVIDER_ID_MAP: Record<string, string> = {
    anthropic: "anthropic",
    openai: "openai",
    google: "google",
    groq: "groq",
    deepseek: "deepseek",
    ollama: "ollama",
    openrouter: "openrouter",
    mistral: "mistralai",
  };

  const FALLBACK_MODELS: Record<string, string[]> = {
    anthropic: [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307",
    ],
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
    google: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
    groq: ["llama-3.1-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    deepseek: ["deepseek-chat", "deepseek-coder"],
    mistral: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"],
    ollama: ["llama3.2", "llama3.1", "codellama", "mistral", "gemma2", "qwen2.5"],
  };

  async function fetchModelsForProvider(
    provider: string,
    apiKey?: string
  ): Promise<string[]> {
    try {
      const providerId = PROVIDER_ID_MAP[provider] || provider;
      const config = apiKey ? { apiKey } : {};
      
      console.log(chalk.cyan(`🔍 Fetching ${provider} models...`));
      const models = await loadModels(providerId, config);
      
      if (models && models.chat && models.chat.length > 0) {
        // Extract model IDs from the chat models
        const modelIds = models.chat.map((model: any) => 
          typeof model === 'string' ? model : model.id || model.name || String(model)
        );
        console.log(chalk.green(`✅ Found ${modelIds.length} models from API`));
        return modelIds;
      }
      
      // Fall back to default models if none found
      console.log(chalk.yellow(`⚠️  No models found from API, using defaults`));
      return FALLBACK_MODELS[provider] || [];
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error}`));
      // Return fallback models on error
      return FALLBACK_MODELS[provider] || [];
    }
  }

  // Test each provider
  const testProviders = ["openrouter", "anthropic", "openai", "ollama", "mistral"];
  
  for (const provider of testProviders) {
    console.log(chalk.yellow(`\n${provider}:`));
    const models = await fetchModelsForProvider(provider);
    console.log(`  Models returned: ${models.length}`);
    if (models.length > 0) {
      console.log(`  First 3 models: ${models.slice(0, 3).join(", ")}`);
    }
  }
}

testRefactoredApproach().catch(console.error);