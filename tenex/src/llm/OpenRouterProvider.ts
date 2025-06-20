import { BaseLLMProvider } from "@/llm/BaseLLMProvider";
import type { LLMContext, LLMMessage, LLMResponse, ProviderTool } from "@/llm/types";
import type { OpenAIToolCall, OpenRouterResponse } from "@/llm/types/responses";
import type { LLMConfig } from "@/utils/agents/types";
import { logger } from "@tenex/shared/logger";

export class OpenRouterProvider extends BaseLLMProvider {
  protected readonly providerName = "OpenRouter";
  protected readonly defaultModel = "";
  protected readonly defaultBaseURL = "https://openrouter.ai/api/v1";

  protected buildRequestBody(
    messages: LLMMessage[],
    config: LLMConfig,
    model: string,
    tools?: ProviderTool[]
  ): Record<string, unknown> {
    // Separate system message from conversation messages
    const systemMessage = messages.find((msg) => msg.role === "system");
    const conversationMessages = messages.filter((msg) => msg.role !== "system");

    // Convert messages to OpenRouter format with caching
    interface OpenRouterMessage {
      role: string;
      content:
        | string
        | Array<{
            type: string;
            text: string;
            cache_control?: { type: string };
          }>;
    }

    const formattedMessages: OpenRouterMessage[] = [];

    // Add system message with caching if enabled
    if (systemMessage) {
      if (config.enableCaching !== false && systemMessage.content.length > 256) {
        // Use cache_control for system prompts and large contexts
        formattedMessages.push({
          role: "system",
          content: [
            {
              type: "text",
              text: systemMessage.content,
              cache_control: { type: "ephemeral" },
            },
          ],
        });
      } else {
        formattedMessages.push({
          role: "system",
          content: systemMessage.content,
        });
      }
    }

    // Process conversation messages
    const cacheBreakpoint = Math.max(0, conversationMessages.length - 1);

    conversationMessages.forEach((msg, index) => {
      // Handle tool messages specially
      if (msg.role === "tool") {
        formattedMessages.push({
          role: "user",
          content: msg.content,
        });
      } else if (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0) {
        // Handle assistant messages with tool calls
        const _toolUses = msg.tool_calls.map((tc) => ({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        }));

        // Ensure there's always text content for non-empty messages
        const textContent = msg.content || "I'll use the following tools:";

        formattedMessages.push({
          role: msg.role,
          content: textContent,
        });
      } else {
        // For messages before the last one, use caching if enabled
        if (config.enableCaching !== false && index < cacheBreakpoint) {
          formattedMessages.push({
            role: msg.role,
            content: [
              {
                type: "text",
                text: msg.content,
                cache_control: { type: "ephemeral" },
              },
            ],
          });
        } else {
          // Last message or caching disabled
          formattedMessages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }
    });

    const requestBody: Record<string, unknown> = {
      model,
      messages: formattedMessages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens || 4096,
      // Include usage data to monitor cache usage
      usage: { include: true },
    };

    // Add tools if provided
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = "auto";
    }

    // Add any additional OpenRouter-specific parameters
    // Note: additionalParams is not part of the LLMConfig interface

    return requestBody;
  }

  protected async makeRequest(
    baseURL: string,
    requestBody: Record<string, unknown>,
    config: LLMConfig
  ): Promise<Response> {
    // Verify the API key format
    if (config.apiKey && !config.apiKey.startsWith("sk-or-")) {
      logger.warn("⚠️  API key does not start with 'sk-or-', might not be a valid OpenRouter key");
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "HTTP-Referer": "tenex-cli",
      "X-Title": "TENEX CLI Agent",
    };

    return fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });
  }

  protected parseResponse(data: OpenRouterResponse): LLMResponse {
    // Validate response structure
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      logger.error("Invalid OpenRouter response structure:", JSON.stringify(data, null, 2));
      throw new Error("Invalid response from OpenRouter: missing or empty choices array");
    }

    // Extract the response
    const choice = data.choices[0];

    // Check if message exists
    if (!choice?.message) {
      logger.error("OpenRouter choice missing message:", JSON.stringify(choice, null, 2));
      throw new Error("Invalid response from OpenRouter: choice missing message");
    }

    // Check if the model returned tool calls in the native format
    let content = choice.message.content || "";
    const toolCalls = choice.message.tool_calls;

    // If content is empty and no tool calls, this is an error
    if (!content && (!toolCalls || toolCalls.length === 0)) {
      logger.error("OpenRouter returned empty response:", JSON.stringify(data, null, 2));
      throw new Error(
        "OpenRouter returned empty response - the model may not be available or configured correctly"
      );
    }

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
            cache_read_input_tokens: data.usage.cached_tokens,
            cost: data.usage.cost,
          }
        : undefined,
    };
  }

  protected extractUsage(
    data: OpenRouterResponse
  ): { prompt_tokens?: number; completion_tokens?: number } | null {
    return data.usage
      ? {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
        }
      : null;
  }

  protected extractToolCallData(
    toolCall: OpenAIToolCall
  ): { name: string; arguments: Record<string, unknown> } | null {
    if (toolCall.function) {
      try {
        const parsedArgs =
          typeof toolCall.function.arguments === "string"
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;

        return {
          name: toolCall.function.name,
          arguments: parsedArgs,
        };
      } catch (e) {
        logger.error("Failed to parse tool call arguments:", e);
        return {
          name: toolCall.function.name,
          arguments: { raw: toolCall.function.arguments },
        };
      }
    }
    return null;
  }
}
