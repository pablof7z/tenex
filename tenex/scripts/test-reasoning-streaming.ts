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

async function testReasoningStreaming() {
  try {
    // Read the llms.json file
    const llmsPath = resolve(process.cwd(), "llms.json");
    const llmsConfig: LLMConfig = JSON.parse(readFileSync(llmsPath, "utf-8"));

    // Models that support reasoning/thinking
    const reasoningModels = [
      "anthropic/claude-3.5-sonnet",
      "anthropic/claude-3-opus",
      "openai/o1-preview",
      "openai/o1-mini",
      "deepseek/deepseek-r1"
    ];

    // Find a configuration with a reasoning-capable model
    let selectedConfig: [string, any] | undefined;
    let selectedModel = "";

    // First try to find OpenRouter config with a reasoning model
    for (const [configName, config] of Object.entries(llmsConfig.configurations)) {
      if (config.provider === "openrouter") {
        // Check if this config uses a reasoning-capable model
        for (const reasoningModel of reasoningModels) {
          if (config.model.includes(reasoningModel)) {
            selectedConfig = [configName, config];
            selectedModel = reasoningModel;
            break;
          }
        }
        if (selectedConfig) break;
      }
    }

    // If no reasoning model found, try to use Claude through OpenRouter
    if (!selectedConfig) {
      const openRouterConfig = Object.entries(llmsConfig.configurations).find(
        ([_, config]) => config.provider === "openrouter"
      );
      
      if (openRouterConfig) {
        selectedConfig = openRouterConfig;
        selectedModel = "anthropic/claude-3.5-sonnet"; // Try to use this model
        console.log(chalk.yellow(`⚠️  No reasoning model found in config. Will try to use ${selectedModel}`));
      }
    }

    if (!selectedConfig) {
      console.error("No OpenRouter configuration found in llms.json");
      process.exit(1);
    }

    const [configName, config] = selectedConfig;
    const credentials = llmsConfig.credentials.openrouter;

    if (!credentials?.apiKey) {
      console.error("No OpenRouter API key found in llms.json");
      process.exit(1);
    }

    console.log(chalk.cyan(`\n🧠 Testing REASONING/THINKING with streaming`));
    console.log(chalk.gray(`   Configuration: ${configName}`));
    console.log(chalk.gray(`   Original Model: ${config.model}`));
    console.log(chalk.gray(`   Testing Model: ${selectedModel}`));
    console.log(chalk.gray(`   Base URL: ${credentials.baseUrl || "https://openrouter.ai/api/v1"}\n`));

    // Import required classes from multi-llm-ts
    const { igniteEngine, Message } = await import("multi-llm-ts");
    
    const engine = igniteEngine("openrouter", {
      apiKey: credentials.apiKey,
      baseURL: credentials.baseUrl || "https://openrouter.ai/api/v1",
    });
    
    // Use the reasoning model
    let chatModel;
    try {
      chatModel = engine.buildModel(selectedModel);
    } catch (error) {
      console.log("⚠️  Could not build model directly, using fallback");
      chatModel = {
        id: selectedModel,
        name: selectedModel,
        capabilities: {
          vision: false,
          tools: true,
          reasoning: true, // Mark as reasoning capable
          caching: false,
        },
      };
    }
    
    console.log(chalk.green("🚀 Starting streaming response with reasoning...\n"));
    console.log(chalk.gray("─".repeat(60)));
    
    // Track streaming data
    let fullContent = "";
    let reasoningContent = "";
    let chunkCount = 0;
    let tokenData: any = null;
    let inReasoning = false;
    const startTime = Date.now();
    
    // Complex prompt that should trigger reasoning
    const complexPrompt = `Solve this step by step: 
    
    A farmer has 17 sheep. All but 9 die. How many sheep are left?
    
    Think through this carefully and show your reasoning process.`;
    
    // Use the generate method for streaming
    const stream = engine.generate(
      chatModel,
      [
        new Message("system", "You are a helpful assistant that thinks step by step."),
        new Message("user", complexPrompt)
      ],
      {
        temperature: 0.3,
        maxTokens: 500,
        usage: true,
        reasoning: true // Enable reasoning if supported
      }
    );
    
    // Process the stream
    for await (const chunk of stream) {
      chunkCount++;
      
      if (chunk.type === "content") {
        // Regular content chunk
        const text = chunk.text || "";
        process.stdout.write(chalk.white(text));
        fullContent += text;
        
        if (chunk.done) {
          console.log("\n");
        }
      } else if (chunk.type === "reasoning" || chunk.type === "thinking") {
        // Reasoning/thinking chunk
        const text = chunk.text || "";
        if (!inReasoning) {
          console.log(chalk.blue("\n💭 [REASONING/THINKING]:"));
          console.log(chalk.gray("─".repeat(40)));
          inReasoning = true;
        }
        process.stdout.write(chalk.blue(text));
        reasoningContent += text;
        
        if (chunk.done) {
          console.log(chalk.gray("\n" + "─".repeat(40)));
          inReasoning = false;
        }
      } else if (chunk.type === "usage") {
        // Usage data chunk
        tokenData = chunk.usage || chunk;
        if (chunk.usage?.completion_tokens_details?.reasoning_tokens) {
          console.log(chalk.yellow("\n📊 Reasoning tokens detected:"), chunk.usage.completion_tokens_details.reasoning_tokens);
        }
      } else {
        // Other chunk types
        console.log(chalk.gray(`\n🔍 Received chunk type: ${chunk.type}`), chunk);
      }
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(chalk.gray("─".repeat(60)));
    
    console.log(chalk.cyan("\n📈 Streaming Summary:"));
    console.log(chalk.gray(`   Total chunks: ${chunkCount}`));
    console.log(chalk.gray(`   Duration: ${duration.toFixed(2)}s`));
    console.log(chalk.gray(`   Content length: ${fullContent.length} characters`));
    console.log(chalk.gray(`   Reasoning length: ${reasoningContent.length} characters`));
    
    if (reasoningContent) {
      console.log(chalk.blue("\n🧠 Full Reasoning Process:"));
      console.log(chalk.gray("─".repeat(40)));
      console.log(chalk.blue(reasoningContent));
      console.log(chalk.gray("─".repeat(40)));
    }
    
    console.log(chalk.green("\n📝 Final Answer:"));
    console.log(chalk.white(fullContent));
    
    if (tokenData) {
      console.log(chalk.yellow("\n🎯 Token usage:"));
      console.log(chalk.gray(`   Prompt tokens: ${tokenData.prompt_tokens || tokenData.promptTokens || 'N/A'}`));
      console.log(chalk.gray(`   Completion tokens: ${tokenData.completion_tokens || tokenData.completionTokens || 'N/A'}`));
      console.log(chalk.gray(`   Total tokens: ${tokenData.total_tokens || tokenData.totalTokens || 'N/A'}`));
      
      if (tokenData.completion_tokens_details?.reasoning_tokens) {
        console.log(chalk.blue(`   Reasoning tokens: ${tokenData.completion_tokens_details.reasoning_tokens}`));
      }
    }
    
    // Test non-streaming for comparison
    console.log(chalk.cyan("\n\n🧪 Testing non-streaming complete with reasoning:"));
    
    try {
      const completeResponse = await engine.complete(
        chatModel,
        [
          new Message("system", "You are a helpful assistant that thinks step by step."),
          new Message("user", "What is 2+2? Think step by step.")
        ],
        {
          temperature: 0.3,
          usage: true,
          reasoning: true,
          maxTokens: 200
        }
      );
      
      console.log(chalk.green("\n✅ Complete Response:"));
      console.log(JSON.stringify(completeResponse, null, 2));
      
      if (completeResponse.reasoning) {
        console.log(chalk.blue("\n💭 Reasoning from complete:"));
        console.log(chalk.blue(completeResponse.reasoning));
      }
    } catch (error) {
      console.log(chalk.red("\n❌ Non-streaming test failed:"), error);
    }
    
  } catch (error) {
    console.error(chalk.red("\n❌ Test failed:"), error);
    process.exit(1);
  }
}

// Run the test
testReasoningStreaming().catch(console.error);