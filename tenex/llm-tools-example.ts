import { Message, igniteEngine, loadOpenRouterModels } from "multi-llm-ts";
import type { FunctionCall, TimeToolArguments } from "./llm-tools-types";

// Tool definition
const GET_TIME_TOOL = {
  type: "function" as const,
  function: {
    name: "get_current_time",
    description: "Get the current time in a specific timezone or UTC",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description:
            'Timezone (e.g. "America/New_York", "Europe/London"). If not provided, returns UTC time.',
        },
        format: {
          type: "string",
          description: 'Time format: "12h" or "24h". Defaults to 24h.',
          enum: ["12h", "24h"],
        },
      },
      required: [],
    },
  },
};

// Tool implementation
function get_current_time(args: TimeToolArguments = {}) {
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

// Robust parser for function calls
export class FunctionCallParser {
  private patterns = [
    // OpenAI/Anthropic style
    /<function_calls?>[\s\S]*?<invoke[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/invoke>[\s\S]*?<\/function_calls?>/g,
    // JSON style
    /\{"function":\s*"([^"]+)",\s*"arguments":\s*({[^}]*})\}/g,
    // XML style
    /<tool[^>]*>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<parameters>([\s\S]*?)<\/parameters>[\s\S]*?<\/tool>/g,
    // Markdown code block style
    /```(?:json|tool|function)?\s*\n?\{[^`]*"(?:function|tool|name)":\s*"([^"]+)"[^`]*"(?:arguments|parameters|args)":\s*({[^}]*})[^`]*\}\s*\n?```/g,
    // Plain text patterns
    /(?:call|invoke|use|execute)\s+(?:function\s+)?([a-zA-Z_]\w*)\s*\(([^)]*)\)/gi,
    /(?:I need to|Let me|I'll)\s+(?:call|use|invoke)\s+the\s+([a-zA-Z_]\w*)\s+(?:function|tool)/gi,
  ];

  parseFunctionCalls(text: string): FunctionCall[] {
    const calls: FunctionCall[] = [];

    for (const pattern of this.patterns) {
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0; // Reset regex state

      match = pattern.exec(text);
      while (match !== null) {
        const functionName = match[1];
        let args: Record<string, unknown> = {};

        if (match[2]) {
          try {
            // Try parsing as JSON
            if (match[2].trim().startsWith("{")) {
              args = JSON.parse(match[2]);
            } else if (match[2].includes("<")) {
              // Parse XML-style parameters
              args = this.parseXMLParameters(match[2]);
            } else {
              // Parse function-style arguments
              args = this.parseFunctionArguments(match[2]);
            }
          } catch (e) {
            // If parsing fails, try to extract key-value pairs
            args = this.parseKeyValuePairs(match[2]);
          }
        }

        calls.push({ name: functionName, arguments: args });
        match = pattern.exec(text);
      }
    }

    // If no structured calls found, look for intent patterns
    if (calls.length === 0) {
      const intentCall = this.parseIntentBasedCall(text);
      if (intentCall) {
        calls.push(intentCall);
      }
    }

    return calls;
  }

  private parseXMLParameters(xml: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    const paramPattern = /<parameter[^>]*name="([^"]+)"[^>]*>([^<]*)<\/parameter>/g;
    let match: RegExpExecArray | null;

    match = paramPattern.exec(xml);
    while (match !== null) {
      params[match[1]] = match[2];
      match = paramPattern.exec(xml);
    }

    return params;
  }

  private parseFunctionArguments(argsString: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    const args = argsString.split(",").map((arg) => arg.trim());

    for (const arg of args) {
      if (arg.includes("=")) {
        const [key, value] = arg.split("=").map((s) => s.trim());
        params[key] = value.replace(/["']/g, "");
      }
    }

    return params;
  }

  private parseKeyValuePairs(text: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    const kvPattern = /(\w+)[:=]\s*["']?([^"',\s}]+)["']?/g;
    let match: RegExpExecArray | null;

    match = kvPattern.exec(text);
    while (match !== null) {
      params[match[1]] = match[2];
      match = kvPattern.exec(text);
    }

    return params;
  }

  private parseIntentBasedCall(text: string): FunctionCall | null {
    const timePatterns = [
      /what(?:'s| is) the (?:current )?time\s*(?:in\s+([^?]+))?/i,
      /tell me the time\s*(?:in\s+([^?]+))?/i,
      /(?:current )?time\s+(?:in\s+)?([^?]+)?/i,
    ];

    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        const location = match[1]?.trim();
        return {
          name: "get_current_time",
          arguments: location ? { timezone: this.guessTimezone(location) } : {},
        };
      }
    }

    return null;
  }

  private guessTimezone(location: string): string {
    const timezoneMap: { [key: string]: string } = {
      "new york": "America/New_York",
      nyc: "America/New_York",
      london: "Europe/London",
      tokyo: "Asia/Tokyo",
      paris: "Europe/Paris",
      "los angeles": "America/Los_Angeles",
      la: "America/Los_Angeles",
      chicago: "America/Chicago",
      sydney: "Australia/Sydney",
      "hong kong": "Asia/Hong_Kong",
      singapore: "Asia/Singapore",
    };

    const normalized = location.toLowerCase();
    return timezoneMap[normalized] || location;
  }
}

// Test function
async function testToolCalling() {
  const engine = igniteEngine("openrouter", {
    apiKey: "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",
    baseURL: "https://openrouter.ai/api/v1",
  });

  const models = await loadOpenRouterModels({
    apiKey: "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",
  });

  const parser = new FunctionCallParser();

  // Test models
  const testModels = [
    "google/gemini-2.5-flash-preview",
    "deepseek/deepseek-chat-v3-0324",
    "anthropic/claude-3.5-sonnet:beta",
    "openai/gpt-4o-mini",
  ];

  for (const modelId of testModels) {
    const model = models.chat.find((m) => m.id === modelId);
    if (!model) {
      console.log(`Model ${modelId} not found, skipping...`);
      continue;
    }

    console.log(`\n=== Testing with ${model.name} ===`);

    const messages = [
      new Message(
        "system",
        `You are a helpful assistant with access to tools. When asked about the time, use the get_current_time function.

Available tools:
${JSON.stringify(GET_TIME_TOOL, null, 2)}

You can call functions using any of these formats:
- <function_calls><invoke name="function_name"><parameter name="param">value</parameter></invoke></function_calls>
- {"function": "function_name", "arguments": {"param": "value"}}
- Or any other clear indication of function calling.`
      ),
      new Message("user", "What time is it in New York?"),
    ];

    try {
      const response = await engine.complete(model, messages);
      console.log(`\nModel response:\n${response.content}`);

      // Parse function calls
      const functionCalls = parser.parseFunctionCalls(response.content || "");
      console.log("\nParsed function calls:", functionCalls);

      // Execute function calls
      for (const call of functionCalls) {
        if (call.name === "get_current_time" || call.name.toLowerCase().includes("time")) {
          const result = get_current_time(call.arguments);
          console.log(`\nFunction result: ${result}`);

          // Send result back to model
          const followUp = [
            ...messages,
            new Message("assistant", response.content || ""),
            new Message("user", `Function get_current_time returned: ${result}`),
          ];

          const finalResponse = await engine.complete(model, followUp);
          console.log(`\nFinal response: ${finalResponse.content}`);
        }
      }
    } catch (error) {
      console.error(
        `Error with ${model.name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    console.log(`\n${"=".repeat(50)}`);
  }
}

// Run the test
if (import.meta.main) {
  testToolCalling().catch(console.error);
}
