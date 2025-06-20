import { BaseLLMProvider } from "@/llm/BaseLLMProvider";
import type { LLMContext, LLMMessage, LLMResponse, ProviderTool } from "@/llm/types";
import type { OpenAIResponse, OpenAIToolCall } from "@/llm/types/responses";
import { ToolCallParser } from "@/llm/utils/ToolCallParser";
import type { LLMConfig } from "@/utils/agents/types";
import { logger } from "@tenex/shared/logger";

export class OpenAIProvider extends BaseLLMProvider {
  protected readonly providerName = "OpenAI";
  protected readonly defaultModel = "gpt-4";
  protected readonly defaultBaseURL = "https://api.openai.com/v1";

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
    };

    // Add tools if provided
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
    logger.debug(`URL: ${baseURL}/chat/completions`);
    logger.debug("Headers:", {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    });

    return fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });
  }

  protected parseResponse(data: OpenAIResponse): LLMResponse {
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
    data: OpenAIResponse
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
    return ToolCallParser.parseOpenAIToolCall(toolCall);
  }
}
