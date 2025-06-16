import { BaseLLMProvider } from "@/utils/agents/llm/BaseLLMProvider";
import type { LLMMessage, LLMResponse, ProviderTool } from "@/utils/agents/llm/types";
import type { LLMConfig } from "@/utils/agents/types";

export class OllamaProvider extends BaseLLMProvider {
    protected readonly providerName = "Ollama";
    protected readonly defaultModel = "llama3.2";
    protected readonly defaultBaseURL = "http://localhost:11434/v1";

    protected buildRequestBody(
        messages: LLMMessage[],
        config: LLMConfig,
        model: string,
        tools?: ProviderTool[]
    ): Record<string, unknown> {
        const requestBody: Record<string, unknown> = {
            model,
            messages,
            temperature: config.temperature ?? 0.7,
            max_tokens: config.maxTokens,
            stream: false, // Disable streaming for consistency
        };

        // Add tools if provided (using OpenAI-compatible format)
        if (tools && tools.length > 0) {
            requestBody.tools = tools;
            requestBody.tool_choice = "auto";
        }

        return requestBody;
    }

    protected async makeRequest(
        baseURL: string,
        requestBody: Record<string, unknown>,
        config: LLMConfig
    ): Promise<Response> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        // Only add Authorization header if API key is provided
        // Some Ollama setups don't require authentication
        if (config.apiKey) {
            headers.Authorization = `Bearer ${config.apiKey}`;
        }

        return fetch(`${baseURL}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody),
        });
    }

    protected parseResponse(data: any): LLMResponse {
        const choice = data.choices[0];

        // Check if the model returned tool calls in the native format
        let content = choice.message.content || "";
        const toolCalls = choice.message.tool_calls;

        // Add tool calls to content
        if (toolCalls && toolCalls.length > 0) {
            content += this.formatToolCallsAsText(toolCalls);
        }

        return {
            content: content,
            model: data.model,
            usage: data.usage
                ? {
                      prompt_tokens: data.usage.prompt_tokens,
                      completion_tokens: data.usage.completion_tokens,
                      total_tokens: data.usage.total_tokens,
                  }
                : undefined,
        };
    }

    protected extractUsage(
        data: any
    ): { prompt_tokens?: number; completion_tokens?: number } | null {
        return data.usage
            ? {
                  prompt_tokens: data.usage.prompt_tokens,
                  completion_tokens: data.usage.completion_tokens,
              }
            : null;
    }

    protected extractToolCallData(toolCall: any): { name: string; arguments: any } | null {
        if (toolCall.function) {
            try {
                return {
                    name: toolCall.function.name,
                    arguments: JSON.parse(toolCall.function.arguments),
                };
            } catch (_e) {
                // Fallback for malformed JSON
                return {
                    name: toolCall.function.name,
                    arguments: { raw: toolCall.function.arguments },
                };
            }
        }
        return null;
    }

    protected validateConfig(config: LLMConfig): void {
        // Ollama doesn't require an API key for local instances
        // Just validate that baseURL is provided or use default
        if (!config.baseURL && !this.defaultBaseURL) {
            throw new Error(`${this.providerName} requires a baseURL`);
        }
    }
}
