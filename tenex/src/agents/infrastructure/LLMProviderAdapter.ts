import { createLLMProvider as createExistingProvider } from "@/llm/LLMFactory";
import type { LLMProvider as ExistingLLMProvider } from "@/llm/types";
import type { ToolRegistry } from "@/utils/agents/tools/ToolRegistry";
import type { LLMConfig } from "@/utils/agents/types";
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
 * Adapter that wraps the existing LLM providers with typing indicator support
 */
export class LLMProviderWithTyping implements ILLMProvider {
    private provider: ExistingLLMProvider;

    constructor(
        private config: LLMConfig,
        private publisher: NostrPublisher,
        toolRegistry?: ToolRegistry
    ) {
        // Use existing factory to create provider
        this.provider = toolRegistry
            ? createExistingProvider(config, toolRegistry)
            : createExistingProvider(config);
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const context = request.context;
        const shouldPublishTyping =
            context &&
            "originalEvent" in context &&
            "projectId" in context &&
            "conversationId" in context;

        try {
            // Convert our request format to existing format
            const existingMessages = request.messages.map((msg) => ({
                role: msg.role,
                content: msg.content,
            }));

            // Start typing indicator if we have full context
            if (shouldPublishTyping && context) {
                const eventContext = context as EventContext & { agentName: string };
                // Extract system prompt and user prompt from messages
                const systemPrompt = existingMessages.find((m) => m.role === "system")?.content;
                const userPrompt = existingMessages.find((m) => m.role === "user")?.content;

                await this.publisher.publishTypingIndicator(context.agentName, true, eventContext, {
                    systemPrompt,
                    userPrompt,
                });
            }

            // Use existing provider
            const response = await this.provider.generateResponse(
                existingMessages,
                {
                    ...this.config,
                    maxTokens: request.maxTokens || this.config.maxTokens,
                    temperature: request.temperature ?? this.config.temperature,
                },
                undefined // LLMContext requires ndk and projectEvent which we don't have here
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
        } finally {
            // Stop typing indicator
            if (shouldPublishTyping && context) {
                const eventContext = context as EventContext & { agentName: string };
                await this.publisher.publishTypingIndicator(context.agentName, false, eventContext);
            }
        }
    }
}

// Factory function using existing infrastructure
export function createLLMProvider(
    config: LLMConfig,
    publisher: NostrPublisher,
    toolRegistry?: ToolRegistry
): ILLMProvider {
    return new LLMProviderWithTyping(config, publisher, toolRegistry);
}
