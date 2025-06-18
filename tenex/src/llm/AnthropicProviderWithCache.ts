import type { LLMContext, LLMMessage, LLMResponse, ProviderTool } from "@/llm/types";
import type { LLMConfig } from "@/utils/agents/types";
import { AnthropicProvider } from "./AnthropicProvider";

export class AnthropicProviderWithCache extends AnthropicProvider {
  protected override buildRequestBody(
    messages: LLMMessage[],
    config: LLMConfig,
    model: string,
    tools?: ProviderTool[]
  ): Record<string, unknown> {
    const baseBody = super.buildRequestBody(messages, config, model, tools);

    // Add cache control logic if caching is enabled
    if (config.enableCaching !== false) {
      return this.addCacheControl(baseBody, messages);
    }

    return baseBody;
  }

  private addCacheControl(
    requestBody: Record<string, unknown>,
    _messages: LLMMessage[]
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
        if (message.content && typeof message.content === "string") {
          const contentLength = message.content.length;
          if (contentLength > 2048) {
            // Cache threshold
            // Convert string content to array format with cache control
            messagesArray[i] = {
              ...message,
              content: [
                {
                  type: "text",
                  text: message.content,
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

  protected override parseResponse(data: unknown): LLMResponse {
    const baseResponse = super.parseResponse(data);

    // Add cache-specific usage information if available
    if (data.usage && baseResponse.usage) {
      baseResponse.usage = {
        ...baseResponse.usage,
        cache_creation_input_tokens: data.usage.cache_creation_input_tokens,
        cache_read_input_tokens: data.usage.cache_read_input_tokens,
      };
    }

    return baseResponse;
  }
}
