import { Message, igniteEngine, loadOpenRouterModels } from "multi-llm-ts";

async function testMultiLLM() {
  // Create OpenRouter engine instance with credentials
  const engine = igniteEngine("openrouter", {
    apiKey: "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",
    baseURL: "https://openrouter.ai/api/v1",
  });

  // Load available models
  const models = await loadOpenRouterModels({
    apiKey: "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",
  });

  console.log(`Loaded ${models.chat.length} chat models from OpenRouter`);

  // Find our models
  const geminiModel = models.chat.find((m) => m.id === "google/gemini-2.5-flash-preview");
  const deepseekModel = models.chat.find((m) => m.id === "deepseek/deepseek-chat-v3-0324");

  if (!geminiModel || !deepseekModel) {
    console.error("Could not find required models");
    return;
  }

  // Test with Gemini model
  console.log("\n---\n");
  console.log("Testing with Gemini 2.5 Flash...");
  try {
    const messages = [
      new Message("system", "You are a helpful assistant."),
      new Message("user", "What is the capital of France? Answer in one word."),
    ];

    const geminiResponse = await engine.complete(geminiModel, messages);
    console.log("Gemini response:", geminiResponse.content);
  } catch (error: any) {
    console.error("Gemini error:", error.message);
  }

  console.log("\n---\n");

  // Test with DeepSeek model
  console.log("Testing with DeepSeek Chat...");
  try {
    const messages = [
      new Message("system", "You are a helpful assistant."),
      new Message("user", "What is 2 + 2? Answer with just the number."),
    ];

    const deepseekResponse = await engine.complete(deepseekModel, messages);
    console.log("DeepSeek response:", deepseekResponse.content);
  } catch (error: any) {
    console.error("DeepSeek error:", error.message);
  }

  // Test streaming
  console.log("\n---\n");
  console.log("Testing streaming with DeepSeek...");
  try {
    const messages = [new Message("user", "Count from 1 to 5, each number on a new line.")];

    const { stream } = await engine.stream(deepseekModel, messages);

    console.log("Streaming response: ");

    // Add timeout
    const timeout = setTimeout(() => {
      console.log("\nStreaming timed out");
      process.exit(0);
    }, 10000);

    for await (const chunk of stream) {
      if (chunk.type === "content" && chunk.text) {
        process.stdout.write(chunk.text);
      }
    }

    clearTimeout(timeout);
    console.log("\n\nAll tests completed successfully!");
  } catch (error: any) {
    console.error("Streaming error:", error.message);
  }
}

// Run the test
testMultiLLM().catch(console.error);
