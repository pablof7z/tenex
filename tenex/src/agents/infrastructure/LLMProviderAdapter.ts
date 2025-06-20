import { createLLMProvider as createExistingProvider } from "@/llm/LLMFactory";
import type { LLMProvider as ExistingLLMProvider } from "@/llm/types";
import type { LLMConfig } from "@/utils/agents/types";
import { logger } from "@tenex/shared/logger";

const llmLogger = logger.forModule("llm");
import { LLMError } from "../core/errors";
import type {
  CompletionRequest,
  CompletionResponse,
  EventContext,
  LLMProvider as ILLMProvider,
  NostrPublisher,
} from "../core/types";

/**
 * Adapter that converts between agent system's LLMProvider interface
 * and the main LLM system's interface
 */
export class LLMProviderAdapter implements ILLMProvider {
  private _provider: ExistingLLMProvider;

  // Expose provider and config for type checking
  get provider(): ExistingLLMProvider {
    return this._provider;
  }

  get config(): LLMConfig {
    return this._config;
  }

  constructor(
    private _config: LLMConfig,
    private publisher: NostrPublisher,
    provider?: ExistingLLMProvider
  ) {
    // Use provided provider or create one
    this._provider = provider || createExistingProvider(_config);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const context = request.context;

    try {
      // Convert our request format to existing format
      const existingMessages = request.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Create LLMContext if we have the necessary information
      const llmContext =
        context && context.ndk && context.projectEvent
          ? {
              ...context,
              ndk: context.ndk,
              projectEvent: context.projectEvent as any, // Cast to NDKProject
              agentName: context.agentName,
              rootEventId: context.rootEventId,
              agent: context.agent,
            }
          : undefined;

      // Use existing provider
      const response = await this._provider.generateResponse(
        existingMessages,
        {
          ...this._config,
          maxTokens: request.maxTokens || this._config.maxTokens,
          temperature: request.temperature ?? this._config.temperature,
        },
        llmContext
      );

      // Convert response format, preserving tool-related properties
      return {
        content: response.content,
        model: response.model,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
              cacheCreationTokens: response.usage.cache_creation_input_tokens,
              cacheReadTokens: response.usage.cache_read_input_tokens,
              cost: response.usage.cost,
            }
          : undefined,
        // Note: Tool execution is now handled at the Agent layer
      };
    } catch (error) {
      llmLogger.error("LLM provider error:", error);
      throw new LLMError(
        `LLM completion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        { provider: this._config.provider, model: this._config.model }
      );
    }
  }
}

// Factory function using existing infrastructure
export function createLLMProvider(config: LLMConfig, publisher: NostrPublisher): ILLMProvider {
  return new LLMProviderAdapter(config, publisher);
}

// For backward compatibility
export { LLMProviderAdapter as LLMProviderWithTyping };
