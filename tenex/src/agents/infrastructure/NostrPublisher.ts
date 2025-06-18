import { NDKEvent, NDKKind, type NDKSigner } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import type { AgentResponse, EventContext, NostrPublisher as INostrPublisher } from "../core/types";

export class NostrPublisher implements INostrPublisher {
    constructor(
        private ndk: NDK,
        private projectSigner?: NDKSigner
    ) {}

    async publishResponse(
        response: AgentResponse,
        context: EventContext,
        agentSigner: NDKSigner
    ): Promise<void> {
        try {
            const responseEvent = context.originalEvent.reply();
            responseEvent.content = response.content;

            // Get agent's pubkey to filter it out
            const agentUser = await agentSigner.user();
            const agentPubkey = agentUser.pubkey;

            // Remove the agent's own p-tag to prevent self-replies
            const originalPTagCount = responseEvent.tags.filter((tag) => tag[0] === "p").length;
            responseEvent.tags = responseEvent.tags.filter((tag) => {
                // Keep all non-p tags, and p-tags that don't reference the agent
                return tag[0] !== "p" || tag[1] !== agentPubkey;
            });
            const newPTagCount = responseEvent.tags.filter((tag) => tag[0] === "p").length;

            if (originalPTagCount > newPTagCount) {
                logger.debug(
                    `Removed agent's own p-tag from reply (${originalPTagCount} -> ${newPTagCount} p-tags)`
                );
            }

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
        },
        signer?: NDKSigner
    ): Promise<void> {
        try {
            const typingEvent = new NDKEvent(this.ndk);
            typingEvent.kind = isTyping ? 24111 : 24112; // typing start/stop
            typingEvent.content = isTyping 
                ? (options?.message || `${agentName} is typing...`)
                : "";

            // Tag the root conversation event
            typingEvent.tags = [
                ["e", context.conversationId],
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

            // Sign with the provided signer (agent's signer when agent is typing)
            // or project signer (when orchestrator is typing), otherwise use NDK default
            const signerToUse = signer || this.projectSigner;
            if (signerToUse) {
                typingEvent.sig = await typingEvent.sign(signerToUse);
            }
            
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
