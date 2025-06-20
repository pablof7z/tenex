#!/usr/bin/env bun

import { Message, igniteEngine, loadOpenRouterModels } from "multi-llm-ts";
import { FunctionCallParser } from "./llm-tools-example.ts";

// Simple time tool implementation
function get_current_time(args: { timezone?: string; format?: string } = {}) {
  const now = new Date();
  const format = args.format || "24h";

  try {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: args.timezone || "UTC",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: format === "12h",
      timeZoneName: "short",
    };

    return now.toLocaleString("en-US", options);
  } catch (error) {
    return `Error: Invalid timezone "${args.timezone}"`;
  }
}

async function main() {
  // Get model from command line or use default
  const modelId = process.argv[2] || "deepseek/deepseek-chat-v3-0324";

  console.log(`🤖 Testing tool calling with model: ${modelId}\n`);

  // Initialize
  const engine = igniteEngine("openrouter", {
    apiKey: "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",
    baseURL: "https://openrouter.ai/api/v1",
  });

  const models = await loadOpenRouterModels({
    apiKey: "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",
  });

  const model = models.chat.find((m) => m.id === modelId);
  if (!model) {
    console.error(`❌ Model ${modelId} not found!`);
    console.log("\nAvailable models:");
    models.chat.slice(0, 10).forEach((m) => console.log(`  - ${m.id}`));
    console.log("  ... and more");
    process.exit(1);
  }

  const parser = new FunctionCallParser();

  // Create conversation
  const messages = [
    new Message(
      "system",
      `You have access to a function called get_current_time that can tell you the current time in any timezone.

When asked about time, respond by calling this function. You can call it using any of these formats:
- <function_calls><invoke name="get_current_time"><parameter name="timezone">America/New_York</parameter></invoke></function_calls>
- {"function": "get_current_time", "arguments": {"timezone": "Europe/London"}}
- Or any clear function call format you prefer.`
    ),
    new Message("user", process.argv[3] || "What time is it in Tokyo?"),
  ];

  console.log(`💬 User: ${messages[1].content}\n`);
  console.log("🔄 Calling LLM...\n");

  try {
    // Get response
    const response = await engine.complete(model, messages);
    console.log(`🤖 Assistant: ${response.content}\n`);

    // Parse function calls
    const functionCalls = parser.parseFunctionCalls(response.content || "");

    if (functionCalls.length > 0) {
      console.log("🔧 Detected function calls:", functionCalls);

      // Execute each function
      for (const call of functionCalls) {
        if (call.name === "get_current_time" || call.name.toLowerCase().includes("time")) {
          const result = get_current_time(call.arguments);
          console.log(`⏰ Function result: ${result}\n`);

          // Send result back
          messages.push(new Message("assistant", response.content || ""));
          messages.push(new Message("user", `The function returned: ${result}`));

          console.log("🔄 Getting final response...\n");
          const finalResponse = await engine.complete(model, messages);
          console.log(`🤖 Final answer: ${finalResponse.content}`);
        }
      }
    } else {
      console.log("ℹ️  No function calls detected in the response.");
    }
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
  }
}

// Run it
main().catch(console.error);
