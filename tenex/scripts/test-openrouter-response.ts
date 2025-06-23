#!/usr/bin/env tsx

import { readFileSync } from "fs";
import { resolve } from "path";

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

async function testOpenRouterResponse() {
  try {
    // Read the llms.json file
    const llmsPath = resolve(process.cwd(), "llms.json");
    const llmsConfig: LLMConfig = JSON.parse(readFileSync(llmsPath, "utf-8"));

    // Find OpenRouter configuration
    const openRouterConfig = Object.entries(llmsConfig.configurations).find(
      ([_, config]) => config.provider === "openrouter"
    );

    if (!openRouterConfig) {
      console.error("No OpenRouter configuration found in llms.json");
      process.exit(1);
    }

    const [configName, config] = openRouterConfig;
    const credentials = llmsConfig.credentials.openrouter;

    if (!credentials?.apiKey) {
      console.error("No OpenRouter API key found in llms.json");
      process.exit(1);
    }

    console.log(`\n🔍 Testing OpenRouter response with configuration: ${configName}`);
    console.log(`   Model: ${config.model}`);
    console.log(`   Base URL: ${credentials.baseUrl || "https://openrouter.ai/api/v1"}\n`);

    // Make a direct API call to OpenRouter
    const response = await fetch(`${credentials.baseUrl || "https://openrouter.ai/api/v1"}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${credentials.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://tenex.dev",
        "X-Title": "TENEX Test Script"
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant."
          },
          {
            role: "user",
            content: "Say 'Hello, World!' in exactly 3 words."
          }
        ],
        temperature: 0.7,
        max_tokens: 10
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ OpenRouter API error: ${response.status} ${response.statusText}`);
      console.error(`   Response: ${errorText}`);
      process.exit(1);
    }

    const data = await response.json();
    
    console.log("✅ OpenRouter API Response:");
    console.log(JSON.stringify(data, null, 2));
    
    console.log("\n📊 Response Analysis:");
    console.log(`   Has 'usage' field: ${!!data.usage}`);
    console.log(`   Has 'model' field: ${!!data.model}`);
    
    if (data.usage) {
      console.log("\n📈 Usage Data:");
      console.log(`   prompt_tokens: ${data.usage.prompt_tokens}`);
      console.log(`   completion_tokens: ${data.usage.completion_tokens}`);
      console.log(`   total_tokens: ${data.usage.total_tokens}`);
    }
    
    console.log("\n🔍 All top-level fields:");
    console.log(`   ${Object.keys(data).join(", ")}`);
    
    // Now test with multi-llm-ts
    console.log("\n\n🧪 Testing with multi-llm-ts library:");
    
    const { igniteEngine } = await import("multi-llm-ts");
    
    const engine = igniteEngine("openrouter", {
      apiKey: credentials.apiKey,
      baseURL: credentials.baseUrl || "https://openrouter.ai/api/v1",
    });
    
    // Try to build the model
    let chatModel;
    try {
      chatModel = engine.buildModel(config.model);
    } catch (error) {
      console.log("⚠️  Could not build model directly, using fallback");
      chatModel = {
        id: config.model,
        name: config.model,
        capabilities: {
          vision: false,
          tools: true,
          reasoning: false,
          caching: false,
        },
      };
    }
    
    // Import Message class for multi-llm-ts
    const { Message } = await import("multi-llm-ts");
    
    const llmResponse = await engine.complete(
      chatModel,
      [
        new Message("system", "You are a helpful assistant."),
        new Message("user", "Say 'Hello, World!' in exactly 3 words.")
      ],
      {
        temperature: 0.7,
	usage: true,
	reasoning: true,
        maxTokens: 10
      }
    );
    
    console.log("\n✅ multi-llm-ts Response:");
    console.log(JSON.stringify(llmResponse, null, 2));
    
    console.log("\n📊 multi-llm-ts Response Analysis:");
    console.log(`   Has 'usage' field: ${!!llmResponse.usage}`);
    console.log(`   Has 'model' field: ${!!llmResponse.model}`);
    console.log(`   Response type: ${typeof llmResponse}`);
    console.log(`   All fields: ${Object.keys(llmResponse).join(", ")}`);
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the test
testOpenRouterResponse().catch(console.error);
