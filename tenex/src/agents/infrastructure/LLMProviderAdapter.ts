import { createLLMProvider as createExistingProvider } from "@/llm/LLMFactory";
import { TypingAwareLLMProvider } from "@/llm/TypingAwareLLMProvider";
import type { LLMProvider as ExistingLLMProvider } from "@/llm/types";
import type { ToolRegistry } from "@/utils/agents/tools/ToolRegistry";
import type { LLMConfig } from "@/utils/agents/types";
import type { NDKSigner } from "@nostr-dev-kit/ndk";
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
    private toolRegistry?: ToolRegistry;

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
        toolRegistry?: ToolRegistry,
        provider?: ExistingLLMProvider
    ) {
        this.toolRegistry = toolRegistry;
        // Use provided provider or create one
        this._provider =
            provider ||
            (toolRegistry
                ? createExistingProvider(_config, toolRegistry)
                : createExistingProvider(_config));
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
                context && "ndk" in context && "projectEvent" in context
                    ? {
                          ...context,
                          ndk: context.ndk,
                          projectEvent: context.projectEvent,
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
                // Preserve tool-related properties if they exist
                ...(response.toolCalls && { toolCalls: response.toolCalls }),
                ...(response.hasNativeToolCalls && {
                    hasNativeToolCalls: response.hasNativeToolCalls,
                }),
                ...(response.tool_calls && { tool_calls: response.tool_calls }),
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
export function createLLMProvider(
    config: LLMConfig,
    publisher: NostrPublisher,
    toolRegistry?: ToolRegistry
): ILLMProvider {
    return new LLMProviderAdapter(config, publisher, toolRegistry);
}

// For backward compatibility
export { LLMProviderAdapter as LLMProviderWithTyping };

/**
 * Type guard to check if a provider is an LLMProviderAdapter
 */
function isLLMProviderAdapter(provider: ILLMProvider): provider is LLMProviderAdapter {
    return provider instanceof LLMProviderAdapter;
}

/**
 * Enhance an existing LLM provider with typing indicator support.
 * This is used when we have the agent context (name and signer) available.
 */
export function enhanceWithTypingIndicators(
    provider: ILLMProvider,
    publisher: NostrPublisher,
    agentName: string,
    signer: NDKSigner
): ILLMProvider {
    // Extract the underlying provider from the adapter
    if (!isLLMProviderAdapter(provider)) {
        llmLogger.warning(
            "Could not enhance provider with typing indicators - provider is not an LLMProviderAdapter"
        );
        return provider;
    }

    const baseProvider = provider.provider;
    if (!baseProvider) {
        llmLogger.warning(
            "Could not enhance provider with typing indicators - no underlying provider found"
        );
        return provider;
    }

    // Wrap with typing awareness
    const typingAwareProvider = new TypingAwareLLMProvider(
        baseProvider,
        publisher,
        agentName,
        signer
    );

    // Return a new adapter with the typing-aware provider
    // IMPORTANT: Do NOT pass toolRegistry here, as the baseProvider already has tools
    const config = provider.config;
    return new LLMProviderAdapter(config, publisher, undefined, typingAwareProvider);
}
