import { NDKEvent, NDKKind, type NDKSigner } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import type { AgentResponse, EventContext, NostrPublisher as INostrPublisher } from "../core/types";

export class NostrPublisher implements INostrPublisher {
    constructor(private ndk: NDK) {}

    async publishResponse(
        response: AgentResponse,
        context: EventContext,
        agentSigner: NDKSigner
    ): Promise<void> {
        try {
            const responseEvent = context.originalEvent.reply();
            responseEvent.content = response.content;

            // Tag the project event for proper association
            if (context.projectEvent) {
                responseEvent.tag(context.projectEvent);
            }

            // Add conversation signal as a tag if present
            if (response.signal) {
                responseEvent.tags.push(["signal", JSON.stringify(response.signal)]);
            }

            // Add LLM metadata tags if present
            if (response.metadata) {
                const { metadata } = response;

                // Model and provider information
                if (metadata.model) {
                    responseEvent.tags.push(["llm-model", metadata.model]);
                }
                if (metadata.provider) {
                    responseEvent.tags.push(["llm-provider", metadata.provider]);
                }

                // Token usage information
                if (metadata.usage) {
                    responseEvent.tags.push([
                        "llm-prompt-tokens",
                        metadata.usage.promptTokens.toString(),
                    ]);
                    responseEvent.tags.push([
                        "llm-completion-tokens",
                        metadata.usage.completionTokens.toString(),
                    ]);
                    responseEvent.tags.push([
                        "llm-total-tokens",
                        metadata.usage.totalTokens.toString(),
                    ]);

                    if (metadata.usage.cacheCreationTokens) {
                        responseEvent.tags.push([
                            "llm-cache-creation-tokens",
                            metadata.usage.cacheCreationTokens.toString(),
                        ]);
                    }
                    if (metadata.usage.cacheReadTokens) {
                        responseEvent.tags.push([
                            "llm-cache-read-tokens",
                            metadata.usage.cacheReadTokens.toString(),
                        ]);
                    }
                    if (metadata.usage.cost) {
                        responseEvent.tags.push(["llm-cost-usd", metadata.usage.cost.toString()]);
                    }
                    if (metadata.usage.costUsd) {
                        responseEvent.tags.push([
                            "llm-cost-usd",
                            metadata.usage.costUsd.toString(),
                        ]);
                    }
                }

                // Prompts
                if (metadata.systemPrompt) {
                    responseEvent.tags.push(["llm-system-prompt", metadata.systemPrompt]);
                }
                if (metadata.userPrompt) {
                    responseEvent.tags.push(["llm-user-prompt", metadata.userPrompt]);
                }

                // Confidence level
                if (metadata.confidence) {
                    responseEvent.tags.push(["llm-confidence", metadata.confidence.toString()]);
                }
            }

            // Sign and publish
            await responseEvent.sign(agentSigner);
            responseEvent.publish();

            logger.info(`Published response from agent to conversation ${context.conversationId}`);
        } catch (error) {
            logger.error("Failed to publish response:", error);
            throw error;
        }
    }

    async publishTypingIndicator(
        agentName: string,
        isTyping: boolean,
        context: EventContext,
        options?: {
            message?: string;
            systemPrompt?: string;
            userPrompt?: string;
        }
    ): Promise<void> {
        try {
            const typingEvent = new NDKEvent(this.ndk);
            typingEvent.kind = isTyping ? 24111 : 24112; // typing start/stop
            typingEvent.content = options?.message || "";

            // Tag the conversation
            typingEvent.tags = [
                ["e", context.originalEvent.id!],
                ["agent", agentName],
            ];

            // Tag the project event for proper association
            if (context.projectEvent) {
                typingEvent.tag(context.projectEvent);
            }

            // Add prompt tags if provided (only for start typing events)
            if (isTyping && options) {
                if (options.systemPrompt) {
                    typingEvent.tags.push(["system-prompt", options.systemPrompt]);
                }
                if (options.userPrompt) {
                    typingEvent.tags.push(["prompt", options.userPrompt]);
                }
            }

            // Use project signer for typing indicators
            // In real implementation, this would come from project context
            await typingEvent.publish();

            logger.debug(
                `Published typing indicator: ${agentName} ${isTyping ? "started" : "stopped"} typing`
            );
        } catch (error) {
            // Don't throw on typing indicator failures - they're not critical
            logger.warn("Failed to publish typing indicator:", error);
        }
    }
}
