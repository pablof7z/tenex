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

async function testDirectAnthropicReasoning() {
  try {
    // Read the llms.json file
    const llmsPath = resolve(process.cwd(), "llms.json");
    const llmsConfig: LLMConfig = JSON.parse(readFileSync(llmsPath, "utf-8"));

    // Check if we have Anthropic credentials
    const anthropicCreds = llmsConfig.credentials.anthropic;
    if (!anthropicCreds?.apiKey) {
      console.error("No Anthropic API key found in llms.json");
      console.log("Reasoning/thinking is currently only available directly through Anthropic API");
      process.exit(1);
    }

    console.log(chalk.cyan(`\n🧠 Testing DIRECT Anthropic API for reasoning/thinking`));
    console.log(chalk.gray(`   Using Claude 3.5 Sonnet (2024-10-22)`));
    console.log(chalk.gray(`   This version supports <thinking> tags\n`));

    // Make a direct API call to Anthropic
    console.log(chalk.green("🚀 Making direct API call to Anthropic...\n"));
    console.log(chalk.gray("─".repeat(60)));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicCreds.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        stream: true,
        messages: [
          {
            role: "user",
            content: `<thinking>
The user wants me to solve a classic riddle. Let me think through this carefully:

"A farmer has 17 sheep. All but 9 die."

The key phrase here is "all but 9". This is often misunderstood. "All but 9" means "all except 9", which means 9 survived.

So if all but 9 die, that means 9 are still alive.
</thinking>

Solve this step by step: A farmer has 17 sheep. All but 9 die. How many sheep are left?`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(chalk.red(`❌ Anthropic API error: ${response.status} ${response.statusText}`));
      console.error(chalk.red(`   Response: ${errorText}`));
      process.exit(1);
    }

    // Process streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let thinkingContent = "";
    let inThinking = false;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const event = JSON.parse(data);
              
              if (event.type === 'content_block_delta') {
                const text = event.delta?.text || '';
                
                // Check if we're in a thinking block
                if (text.includes('<thinking>')) {
                  inThinking = true;
                  console.log(chalk.blue("\n💭 [THINKING]:"));
                  console.log(chalk.gray("─".repeat(40)));
                }
                
                if (inThinking && !text.includes('</thinking>')) {
                  process.stdout.write(chalk.blue(text));
                  thinkingContent += text;
                } else if (text.includes('</thinking>')) {
                  inThinking = false;
                  console.log(chalk.gray("\n" + "─".repeat(40) + "\n"));
                } else {
                  process.stdout.write(chalk.white(text));
                  fullContent += text;
                }
              } else if (event.type === 'message_delta' && event.usage) {
                console.log(chalk.yellow("\n\n📊 Usage data:"), event.usage);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    }

    console.log(chalk.gray("\n" + "─".repeat(60)));

    if (thinkingContent) {
      console.log(chalk.blue("\n🧠 Full Thinking Process:"));
      console.log(chalk.gray("─".repeat(40)));
      console.log(chalk.blue(thinkingContent));
      console.log(chalk.gray("─".repeat(40)));
    }

    console.log(chalk.green("\n📝 Final Answer:"));
    console.log(chalk.white(fullContent));

    // Now test with multi-llm-ts to see if it handles thinking
    console.log(chalk.cyan("\n\n🧪 Testing with multi-llm-ts (Anthropic direct):"));
    
    const { igniteEngine, Message } = await import("multi-llm-ts");
    
    const engine = igniteEngine("anthropic", {
      apiKey: anthropicCreds.apiKey,
    });
    
    const chatModel = {
      id: "claude-3-5-sonnet-20241022",
      name: "Claude 3.5 Sonnet",
      capabilities: {
        vision: true,
        tools: true,
        reasoning: true,
        caching: true,
      },
    };
    
    console.log(chalk.gray("\nUsing generate() for streaming..."));
    
    const stream = engine.generate(
      chatModel,
      [
        new Message("user", "What is 25 * 4? Think step by step.")
      ],
      {
        temperature: 0.3,
        maxTokens: 300,
        usage: true,
        reasoning: true
      }
    );
    
    let mlContent = "";
    let mlThinking = "";
    
    for await (const chunk of stream) {
      if (chunk.type === "content") {
        process.stdout.write(chunk.text || "");
        mlContent += chunk.text || "";
      } else if (chunk.type === "thinking" || chunk.type === "reasoning") {
        if (!mlThinking) {
          console.log(chalk.blue("\n💭 [MULTI-LLM-TS THINKING]:"));
        }
        process.stdout.write(chalk.blue(chunk.text || ""));
        mlThinking += chunk.text || "";
      } else if (chunk.type === "usage") {
        console.log(chalk.yellow("\n📊 multi-llm-ts usage:"), chunk);
      }
    }
    
    if (mlThinking) {
      console.log(chalk.blue("\n\n🧠 multi-llm-ts thinking:"));
      console.log(chalk.blue(mlThinking));
    }
    
  } catch (error) {
    console.error(chalk.red("\n❌ Test failed:"), error);
    process.exit(1);
  }
}

// Run the test
testDirectAnthropicReasoning().catch(console.error);