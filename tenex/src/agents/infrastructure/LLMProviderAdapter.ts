import { createLLMProvider as createExistingProvider } from "@/llm/LLMFactory";
import type { LLMProvider as ExistingLLMProvider } from "@/llm/types";
import { TypingAwareLLMProvider } from "@/llm/TypingAwareLLMProvider";
import type { ToolRegistry } from "@/utils/agents/tools/ToolRegistry";
import type { LLMConfig } from "@/utils/agents/types";
import type { NDKSigner } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
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
    private provider: ExistingLLMProvider;
    private toolRegistry?: ToolRegistry;

    constructor(
        private config: LLMConfig,
        private publisher: NostrPublisher,
        toolRegistry?: ToolRegistry,
        provider?: ExistingLLMProvider
    ) {
        this.toolRegistry = toolRegistry;
        // Use provided provider or create one
        this.provider = provider || (toolRegistry
            ? createExistingProvider(config, toolRegistry)
            : createExistingProvider(config));
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
            const llmContext = (context && 'ndk' in context && 'projectEvent' in context) ? {
                ...context,
                ndk: context.ndk,
                projectEvent: context.projectEvent,
                agentName: context.agentName,
                conversationId: context.conversationId,
            } : undefined;

            // Use existing provider
            const response = await this.provider.generateResponse(
                existingMessages,
                {
                    ...this.config,
                    maxTokens: request.maxTokens || this.config.maxTokens,
                    temperature: request.temperature ?? this.config.temperature,
                },
                llmContext
            );

            // Convert response format
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
            };
        } catch (error) {
            logger.error("LLM provider error:", error);
            throw new LLMError(
                `LLM completion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                { provider: this.config.provider, model: this.config.model }
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
    const baseProvider = (provider as any).provider as ExistingLLMProvider;
    if (!baseProvider) {
        logger.warn("Could not enhance provider with typing indicators - provider structure not recognized");
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
    const config = (provider as any).config;
    return new LLMProviderAdapter(config, publisher, undefined, typingAwareProvider);
}