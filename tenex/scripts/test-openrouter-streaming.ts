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

async function testOpenRouterStreaming() {
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

    console.log(`\n🔍 Testing OpenRouter STREAMING with configuration: ${configName}`);
    console.log(`   Model: ${config.model}`);
    console.log(`   Base URL: ${credentials.baseUrl || "https://openrouter.ai/api/v1"}\n`);

    // Import required classes from multi-llm-ts
    const { igniteEngine, Message } = await import("multi-llm-ts");
    
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
    
    console.log("🚀 Starting streaming response...\n");
    console.log("─".repeat(50));
    
    // Track streaming data
    let fullContent = "";
    let chunkCount = 0;
    let tokenData: any = null;
    const startTime = Date.now();
    
    // Use the generate method for streaming
    const stream = engine.generate(
      chatModel,
      [
        new Message("system", "You are a Paul Graham."),
        new Message("user", "Write a a 1000-word essay about streaming data. Think hard about what to write at each step. Once you are done, review it.")
      ],
      {
        temperature: 0.7,
        maxTokens: 100,
        usage: true
      }
    );
    
    // Process the stream
    for await (const chunk of stream) {
      chunkCount++;
      
      if (chunk.type === "content") {
        // Content chunk
        process.stdout.write(chunk.text || "");
        fullContent += chunk.text || "";
        
        if (chunk.done) {
          console.log("\n");
          console.log("─".repeat(50));
        }
      } else if (chunk.type === "usage") {
        // Usage data chunk - extract the actual usage object
        tokenData = chunk.usage || chunk;
        console.log("\n📊 Usage data received:", JSON.stringify(chunk, null, 2));
      } else {
        // Other chunk types
        console.log(`\n🔍 Received chunk type: ${chunk.type}`, chunk);
      }
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log("\n📈 Streaming Summary:");
    console.log(`   Total chunks: ${chunkCount}`);
    console.log(`   Duration: ${duration.toFixed(2)}s`);
    console.log(`   Content length: ${fullContent.length} characters`);
    console.log(`   Full content:\n${fullContent}`);
    
    if (tokenData) {
      console.log("\n🎯 Final token usage:");
      console.log(`   Prompt tokens: ${tokenData.prompt_tokens || tokenData.promptTokens || 'N/A'}`);
      console.log(`   Completion tokens: ${tokenData.completion_tokens || tokenData.completionTokens || 'N/A'}`);
      console.log(`   Total tokens: ${tokenData.total_tokens || tokenData.totalTokens || 'N/A'}`);
    } else {
      console.log("\n⚠️  No usage data received in stream");
    }
    
    // Now test if we can also get usage data from a non-streaming complete call
    console.log("\n\n🧪 Testing non-streaming complete for comparison:");
    
    const completeResponse = await engine.complete(
      chatModel,
      [
        new Message("system", "You are a helpful assistant."),
        new Message("user", "Say hello in 3 words.")
      ],
      {
        temperature: 0.7,
        usage: true,
        maxTokens: 10
      }
    );
    
    console.log("\n✅ Complete Response:", JSON.stringify(completeResponse, null, 2));
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the test
testOpenRouterStreaming().catch(console.error);