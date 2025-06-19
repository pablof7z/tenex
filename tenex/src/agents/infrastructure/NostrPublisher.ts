import { NDKEvent, NDKKind, type NDKSigner } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";
import { type VerbosityLevel, logger } from "@tenex/shared/logger";

const nostrLogger = logger.forModule("nostr");
import type { AgentResponse, EventContext, NostrPublisher as INostrPublisher } from "../core/types";

export class NostrPublisher implements INostrPublisher {
    constructor(private ndk: NDK) {}

    async publishResponse(
        response: AgentResponse,
        context: EventContext,
        agentSigner: NDKSigner,
        agentName?: string
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
                const agentPrefix = agentName ? `[${agentName}] ` : "";
                nostrLogger.debug(
                    `${agentPrefix}Removed agent's own p-tag from reply (${originalPTagCount} -> ${newPTagCount} p-tags)`,
                    "verbose" as VerbosityLevel
                );
            }

            // Tag the project event - CRITICAL for proper association
            responseEvent.tag(context.projectEvent);

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

                // Raw response
                if (metadata.rawResponse) {
                    responseEvent.tags.push(["llm-raw-response", metadata.rawResponse]);
                }

                // Confidence level
                if (metadata.confidence) {
                    responseEvent.tags.push(["llm-confidence", metadata.confidence.toString()]);
                }
            }

            // Sign and publish
            await responseEvent.sign(agentSigner);
            await responseEvent.publish();

            const agentPrefix = agentName ? `[${agentName}] ` : "";
            try {
                const encodedEvent = responseEvent.encode();
                nostrLogger.info(`${agentPrefix}Published response ${encodedEvent}`);
            } catch {
                // Fallback if encoding fails (e.g., in tests with incomplete event objects)
                nostrLogger.info(
                    `${agentPrefix}Published response ${responseEvent.id || "unknown-id"}`
                );
            }
        } catch (error) {
            const agentPrefix = agentName ? `[${agentName}] ` : "";
            nostrLogger.error(`${agentPrefix}Failed to publish response:`, error);
            throw error;
        }
    }

    async publishTypingIndicator(
        agentName: string,
        isTyping: boolean,
        context: EventContext,
        signer: NDKSigner,
        options?: {
            message?: string;
            systemPrompt?: string;
            userPrompt?: string;
        }
    ): Promise<void> {
        try {
            const typingEvent = new NDKEvent(this.ndk);
            typingEvent.kind = isTyping ? 24111 : 24112; // typing start/stop
            typingEvent.content = isTyping ? options?.message || `${agentName} is typing...` : "";

            // Tag the root conversation event
            typingEvent.tags = [
                ["e", context.rootEventId],
                ["agent", agentName],
            ];

            // Tag the project event - CRITICAL for proper association
            typingEvent.tag(context.projectEvent);

            // Add prompt tags if provided (only for start typing events)
            if (isTyping && options) {
                if (options.systemPrompt) {
                    typingEvent.tags.push(["system-prompt", options.systemPrompt]);
                }
                if (options.userPrompt) {
                    typingEvent.tags.push(["prompt", options.userPrompt]);
                }
            }

            // Sign with the provided signer
            await typingEvent.sign(signer);

            await typingEvent.publish();

            nostrLogger.debug(
                `Published typing indicator: ${agentName} ${isTyping ? "started" : "stopped"} typing`,
                "verbose" as VerbosityLevel
            );
        } catch (error) {
            // Don't throw on typing indicator failures - they're not critical
            nostrLogger.warning(
                "Failed to publish typing indicator:",
                error,
                "normal" as VerbosityLevel
            );
        }
    }
}
