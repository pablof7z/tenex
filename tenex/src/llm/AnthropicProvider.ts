import { BaseLLMProvider } from "@/llm/BaseLLMProvider";
import type { LLMMessage, LLMResponse, ProviderTool } from "@/llm/types";
import type { AnthropicContent, AnthropicResponse } from "@/llm/types/responses";
import { extractResponseContent, isAnthropicResponse, normalizeUsage } from "@/llm/types/responses";
import { ToolCallParser } from "@/llm/utils/ToolCallParser";
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

        // Add cache control if caching is enabled
        if (config.enableCaching !== false) {
            return this.addCacheControl(requestBody, messages);
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
                "x-api-key": config.apiKey || "",
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(requestBody),
        });
    }

    protected parseResponse(data: unknown): LLMResponse {
        if (!isAnthropicResponse(data)) {
            throw new Error("Invalid Anthropic response format");
        }

        let content = extractResponseContent(data);
        const toolCalls: AnthropicContent[] = [];

        for (const block of data.content) {
            if (block.type === "tool_use") {
                toolCalls.push(block);
            }
        }

        // Add tool calls to content
        if (toolCalls.length > 0) {
            content += this.formatToolCallsAsText(toolCalls);
        }

        const normalizedUsage = normalizeUsage(data);

        return {
            content,
            model: data.model,
            usage: normalizedUsage
                ? {
                      prompt_tokens: normalizedUsage.promptTokens,
                      completion_tokens: normalizedUsage.completionTokens,
                      total_tokens: normalizedUsage.totalTokens,
                      cache_creation_input_tokens: normalizedUsage.cacheCreationTokens,
                      cache_read_input_tokens: normalizedUsage.cacheReadTokens,
                  }
                : undefined,
        };
    }

    protected extractUsage(
        data: AnthropicResponse
    ): { prompt_tokens?: number; completion_tokens?: number } | null {
        return data.usage
            ? {
                  prompt_tokens: data.usage.input_tokens,
                  completion_tokens: data.usage.output_tokens,
              }
            : null;
    }

    protected extractToolCallData(
        toolCall: AnthropicContent
    ): { name: string; arguments: Record<string, unknown> } | null {
        return ToolCallParser.parseAnthropicToolCall(toolCall);
    }

    private addCacheControl(
        requestBody: Record<string, unknown>,
        messages: LLMMessage[]
    ): Record<string, unknown> {
        const modifiedBody = { ...requestBody };

        // Add cache control to system message if it exists and is long enough
        if (modifiedBody.system && typeof modifiedBody.system === "string") {
            const systemLength = modifiedBody.system.length;
            if (systemLength > 2048) {
                // Cache threshold
                modifiedBody.system = [
                    {
                        type: "text",
                        text: modifiedBody.system,
                        cache_control: { type: "ephemeral" },
                    },
                ];
            }
        }

        // Add cache control to messages - cache the last long message that qualifies
        if (Array.isArray(modifiedBody.messages)) {
            const messagesArray = modifiedBody.messages as LLMMessage[];

            // Find the last message that's long enough to cache (working backwards)
            for (let i = messagesArray.length - 1; i >= 0; i--) {
                const message = messagesArray[i];
                if (message?.content && typeof message.content === "string") {
                    const contentLength = message.content.length;
                    if (contentLength > 2048) {
                        // Cache threshold
                        // Convert string content to array format with cache control
                        (messagesArray[i] as any) = {
                            ...message,
                            content: [
                                {
                                    type: "text",
                                    text: message.content as string,
                                    cache_control: { type: "ephemeral" },
                                },
                            ],
                        };
                        break; // Only cache one message to avoid excessive cache usage
                    }
                }
            }
        }

        return modifiedBody;
    }
}
