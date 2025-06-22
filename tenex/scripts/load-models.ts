#!/usr/bin/env npx tsx

import { loadModels } from "multi-llm-ts";
import chalk from "chalk";

async function testLoadModels() {
  console.log(chalk.cyan("🔍 Testing loadModels from multi-llm-ts\n"));

  const providers = [
    { id: "anthropic", name: "Anthropic", needsApiKey: true },
    { id: "openai", name: "OpenAI", needsApiKey: true },
    { id: "google", name: "Google", needsApiKey: true },
    { id: "groq", name: "Groq", needsApiKey: true },
    { id: "deepseek", name: "DeepSeek", needsApiKey: true },
    { id: "mistralai", name: "Mistral", needsApiKey: true },
    { id: "openrouter", name: "OpenRouter", needsApiKey: false },
    { id: "ollama", name: "Ollama", needsApiKey: false },
  ];

  for (const provider of providers) {
    console.log(chalk.yellow(`\n${provider.name}:`));
    
    try {
      // For providers that need API key, we'll use a dummy key to see what happens
      // In real usage, you'd use actual API keys
      const config = provider.needsApiKey ? { apiKey: "dummy-key-for-testing" } : {};
      
      const models = await loadModels(provider.id, config);
      
      if (models.chat && models.chat.length > 0) {
        console.log(chalk.green(`✅ Found ${models.chat.length} chat models:`));
        models.chat.slice(0, 5).forEach((model: any) => {
          console.log(`   - ${model.id || model}`);
        });
        if (models.chat.length > 5) {
          console.log(`   ... and ${models.chat.length - 5} more`);
        }
      } else {
        console.log(chalk.gray("   No chat models found"));
      }

      if (models.image && models.image.length > 0) {
        console.log(chalk.blue(`🖼️  Found ${models.image.length} image models`));
      }

      if (models.embedding && models.embedding.length > 0) {
        console.log(chalk.magenta(`📊 Found ${models.embedding.length} embedding models`));
      }

    } catch (error) {
      console.log(chalk.red(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`));
      
      // Try without API key for providers that might work without it
      if (provider.needsApiKey) {
        try {
          console.log(chalk.gray("   Retrying without API key..."));
          const models = await loadModels(provider.id, {});
          if (models.chat && models.chat.length > 0) {
            console.log(chalk.green(`   ✅ Works without API key! Found ${models.chat.length} models`));
            models.chat.slice(0, 3).forEach((model: any) => {
              console.log(`      - ${model.id || model}`);
            });
          }
        } catch (retryError) {
          console.log(chalk.gray("   Still requires API key"));
        }
      }
    }
  }

  console.log(chalk.cyan("\n\n📝 Summary:"));
  console.log("- loadModels can fetch models for all providers");
  console.log("- Some providers (Ollama, OpenRouter) work without API keys");
  console.log("- Other providers may return a default list or require valid API keys");
}

testLoadModels().catch(console.error);