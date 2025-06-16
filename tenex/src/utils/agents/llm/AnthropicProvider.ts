import { BaseLLMProvider } from "@/utils/agents/llm/BaseLLMProvider";
import type { LLMMessage, LLMResponse, ProviderTool } from "@/utils/agents/llm/types";
import type { LLMConfig } from "@/utils/agents/types";

export class AnthropicProvider extends BaseLLMProvider {
    protected readonly providerName = "Anthropic";
    protected readonly defaultModel = "claude-3-opus-20240229";
    protected readonly defaultBaseURL = "https://api.anthropic.com/v1";

    protected buildRequestBody(
        messages: LLMMessage[],
        config: LLMConfig,
        model: string,
        tools?: ProviderTool[]
    ): Record<string, unknown> {
        // Separate system message from conversation messages
        const systemMessage = messages.find((msg) => msg.role === "system");
        const conversationMessages = messages.filter((msg) => msg.role !== "system");

        const requestBody: Record<string, unknown> = {
            model,
            messages: conversationMessages,
            max_tokens: config.maxTokens || 4096,
            temperature: config.temperature ?? 0.7,
        };

        // Add system message if present
        if (systemMessage) {
            requestBody.system = systemMessage.content;
        }

        // Add tools if provided
        if (tools && tools.length > 0) {
            requestBody.tools = tools;
            requestBody.tool_choice = { type: "auto" };
        }

        return requestBody;
    }

    protected async makeRequest(
        baseURL: string,
        requestBody: Record<string, unknown>,
        config: LLMConfig
    ): Promise<Response> {
        return fetch(`${baseURL}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": config.apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(requestBody),
        });
    }

    protected parseResponse(data: any): LLMResponse {
        // Extract content - Anthropic returns an array of content blocks
        let content = "";
        const toolCalls: any[] = [];

        for (const block of data.content) {
            if (block.type === "text") {
                content += block.text;
            } else if (block.type === "tool_use") {
                toolCalls.push(block);
            }
        }

        // Add tool calls to content
        content += this.formatToolCallsAsText(toolCalls);

        return {
            content: content,
            model: data.model,
            usage: data.usage
                ? {
                      prompt_tokens: data.usage.input_tokens,
                      completion_tokens: data.usage.output_tokens,
                      total_tokens: data.usage.input_tokens + data.usage.output_tokens,
                  }
                : undefined,
        };
    }

    protected extractUsage(
        data: any
    ): { prompt_tokens?: number; completion_tokens?: number } | null {
        return data.usage
            ? {
                  prompt_tokens: data.usage.input_tokens,
                  completion_tokens: data.usage.output_tokens,
              }
            : null;
    }

    protected extractToolCallData(toolCall: any): { name: string; arguments: any } | null {
        if (toolCall.type === "tool_use") {
            return {
                name: toolCall.name,
                arguments: toolCall.input,
            };
        }
        return null;
    }
}
