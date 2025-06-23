#!/usr/bin/env tsx

import { readFileSync } from "fs";
import { resolve } from "path";
import chalk from "chalk";

interface LLMConfig {
  configurations: Record<string, {
    provider: string;
    model: string;
  }>;
  credentials: Record<string, {
    apiKey: string;
    baseUrl?: string;
  }>;
}

async function checkOpenRouterModels() {
  try {
    // Read the llms.json file
    const llmsPath = resolve(process.cwd(), "llms.json");
    const llmsConfig: LLMConfig = JSON.parse(readFileSync(llmsPath, "utf-8"));

    const credentials = llmsConfig.credentials.openrouter;
    if (!credentials?.apiKey) {
      console.error("No OpenRouter API key found in llms.json");
      process.exit(1);
    }

    console.log(chalk.cyan("\n🔍 Fetching OpenRouter models with reasoning capabilities...\n"));

    // Fetch models from OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        "Authorization": `Bearer ${credentials.apiKey}`,
        "HTTP-Referer": "https://tenex.dev",
        "X-Title": "TENEX Model Check"
      }
    });

    if (!response.ok) {
      console.error(chalk.red(`❌ Failed to fetch models: ${response.status}`));
      process.exit(1);
    }

    const data = await response.json();
    const models = data.data || [];

    // Find models that might support reasoning/thinking
    const reasoningKeywords = ['reasoning', 'thinking', 'o1', 'deepseek-r1', 'claude'];
    const reasoningModels = models.filter((model: any) => {
      const id = model.id.toLowerCase();
      const name = (model.name || '').toLowerCase();
      const desc = (model.description || '').toLowerCase();
      
      return reasoningKeywords.some(keyword => 
        id.includes(keyword) || name.includes(keyword) || desc.includes(keyword)
      );
    });

    console.log(chalk.green(`Found ${reasoningModels.length} models that might support reasoning:\n`));

    reasoningModels.forEach((model: any) => {
      console.log(chalk.yellow(`📦 ${model.id}`));
      console.log(chalk.gray(`   Name: ${model.name || 'N/A'}`));
      if (model.description) {
        console.log(chalk.gray(`   Description: ${model.description.substring(0, 100)}...`));
      }
      console.log(chalk.gray(`   Context: ${model.context_length || 'N/A'}`));
      console.log(chalk.gray(`   Pricing: $${model.pricing?.prompt || 'N/A'}/1M prompt, $${model.pricing?.completion || 'N/A'}/1M completion`));
      console.log();
    });

    // Test if OpenRouter supports thinking/reasoning in responses
    console.log(chalk.cyan("\n🧪 Testing OpenRouter API for reasoning support...\n"));

    const testResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${credentials.apiKey}`,
        "HTTP-Referer": "https://tenex.dev",
        "X-Title": "TENEX Test",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        messages: [
          {
            role: "user",
            content: "What is 2+2? Show your thinking process."
          }
        ],
        stream: true,
        // Try various options that might enable reasoning
        include_reasoning: true,
        show_thinking: true,
        reasoning: true,
        temperature: 0.3
      })
    });

    if (!testResponse.ok) {
      console.error(chalk.red(`❌ Test request failed: ${testResponse.status}`));
      const error = await testResponse.text();
      console.error(error);
      return;
    }

    console.log(chalk.green("✅ Streaming response:"));
    console.log(chalk.gray("─".repeat(50)));

    const reader = testResponse.body?.getReader();
    const decoder = new TextDecoder();
    let hasReasoningContent = false;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            if (!data) continue;

            try {
              const parsed = JSON.parse(data);
              
              // Check for reasoning in various places
              if (parsed.choices?.[0]?.delta?.reasoning) {
                hasReasoningContent = true;
                console.log(chalk.blue("💭 Reasoning:"), parsed.choices[0].delta.reasoning);
              }
              
              if (parsed.choices?.[0]?.delta?.content) {
                process.stdout.write(parsed.choices[0].delta.content);
              }
              
              // Log the full structure if it contains reasoning-related fields
              const str = JSON.stringify(parsed);
              if (str.includes('reasoning') || str.includes('thinking')) {
                console.log(chalk.yellow("\n🔍 Found reasoning-related field:"));
                console.log(chalk.gray(JSON.stringify(parsed, null, 2)));
              }
            } catch (e) {
              // Skip parse errors
            }
          }
        }
      }
    }

    console.log(chalk.gray("\n" + "─".repeat(50)));
    
    if (!hasReasoningContent) {
      console.log(chalk.yellow("\n⚠️  No separate reasoning/thinking content detected in OpenRouter response"));
      console.log(chalk.gray("OpenRouter may not expose reasoning as separate chunks"));
    }

  } catch (error) {
    console.error(chalk.red("\n❌ Error:"), error);
    process.exit(1);
  }
}

// Run the check
checkOpenRouterModels().catch(console.error);