import type { ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import type { StrategyExecutionResult } from "@/core/orchestration/strategies/OrchestrationStrategy";
import type { Agent } from "@/utils/agents/Agent";
import type { AgentResponse } from "@/utils/agents/types";
import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import { EVENT_KINDS } from "@tenex/types/events";

/**
 * Enhanced response publisher that consolidates all publishing functionality
 * from AgentCommunicationHandler into a reusable service
 */
export class EnhancedResponsePublisher {
    constructor(
        private ndk: NDK,
        private projectInfo?: ProjectRuntimeInfo
    ) {}

    /**
     * Publish typing indicator event with full metadata support
     */
    async publishTypingIndicator(
        originalEvent: NDKEvent,
        agent: Agent,
        isTyping: boolean,
        message?: string,
        systemPrompt?: string,
        userPrompt?: string
    ): Promise<void> {
        let typingEvent: NDKEvent | undefined;

        try {
            typingEvent = new NDKEvent(this.ndk);
            typingEvent.kind = isTyping
                ? EVENT_KINDS.TYPING_INDICATOR
                : EVENT_KINDS.TYPING_INDICATOR_STOP;
            typingEvent.content = message || (isTyping ? `${agent.getName()} is typing...` : "");

            // Add event reference
            typingEvent.tags.push(["e", originalEvent.id]);

            // Add project reference - REQUIRED
            if (!this.projectInfo?.projectEvent) {
                throw new Error(
                    "Project event is required for tenex run - cannot proceed without project context"
                );
            }

            // Add project reference using manual 'a' tag approach
            await this.addProjectReference(typingEvent);

            // Add system prompt for start typing events
            if (isTyping && systemPrompt) {
                typingEvent.tags.push(["system-prompt", systemPrompt]);
            }

            // Add user prompt for start typing events
            logger.debug(
                `Typing indicator userPrompt: ${userPrompt ? `"${userPrompt.substring(0, 100)}..."` : "undefined"}`
            );
            if (isTyping && userPrompt) {
                typingEvent.tags.push(["prompt", userPrompt]);
                logger.debug(
                    `Added prompt tag to typing indicator: "${userPrompt.substring(0, 100)}..."`
                );
            } else if (isTyping) {
                logger.debug("No userPrompt for typing indicator - prompt tag will NOT be added");
            }

            await typingEvent.sign(agent.getSigner());
            await typingEvent.publish();
        } catch (error) {
            logger.warn(`Failed to publish typing indicator: ${error}`);
            if (error instanceof Error) {
                logger.debug(`Error stack: ${error.stack}`);
            }
            if (typingEvent) {
                logger.debug(`Typing event kind: ${typingEvent.kind}`);
                logger.debug(`Typing event tags: ${JSON.stringify(typingEvent.tags, null, 2)}`);
                if (typeof typingEvent.inspect === "function") {
                    logger.debug(`Typing event details: ${typingEvent.inspect()}`);
                }
            }
        }
    }

    /**
     * Publish response event with comprehensive metadata
     */
    async publishResponse(
        originalEvent: NDKEvent,
        response: AgentResponse,
        agent: Agent,
        _isTaskEvent = false
    ): Promise<void> {
        try {
            // Create reply event with proper reply tags
            const responseEvent = originalEvent.reply();

            // Check if we have renderInChat data
            if (response.renderInChat) {
                // For renderInChat responses, we encode the data in a special format
                const renderData = {
                    type: response.renderInChat.type,
                    data: response.renderInChat.data,
                    content: response.content, // Include original content
                };
                responseEvent.content = JSON.stringify(renderData);
                // Add a tag to indicate this is a special render type
                responseEvent.tags.push(["render-type", response.renderInChat.type]);
            } else {
                responseEvent.content = response.content;
            }

            // Remove all p-tags that NDK's .reply() generated
            responseEvent.tags = responseEvent.tags.filter((tag) => tag[0] !== "p");

            // Add project reference
            await this.addProjectReference(responseEvent);

            // Add LLM metadata if available
            this.addLLMMetadata(responseEvent, response);

            // Add prompts if available
            if (response.metadata?.systemPrompt) {
                responseEvent.tags.push(["system-prompt", response.metadata.systemPrompt]);
            }
            if (response.metadata?.userPrompt) {
                responseEvent.tags.push(["prompt", response.metadata.userPrompt]);
            } else {
                logger.debug("No userPrompt found - prompt tag will NOT be added");
            }

            await responseEvent.sign(agent.getSigner());
            responseEvent.publish();
        } catch (error) {
            logger.error(`Failed to publish response: ${error}`);
        }
    }

    /**
     * Publish responses from strategy execution
     */
    async publishStrategyResponses(
        strategyResult: StrategyExecutionResult,
        originalEvent: NDKEvent,
        _conversationId: string,
        agents: Map<string, Agent>
    ): Promise<void> {
        if (!strategyResult.success) {
            logger.error(
                `Strategy execution failed: ${strategyResult.errors?.map((e) => e.message).join(", ")}`
            );
            return;
        }

        // Publish each agent's response
        for (const response of strategyResult.responses) {
            try {
                const agent = agents.get(response.agentName);
                if (!agent) {
                    logger.error(`Agent ${response.agentName} not found in agents map`);
                    continue;
                }

                // Create a mock AgentResponse object for the publishResponse method
                const agentResponse: AgentResponse = {
                    content: response.response,
                    confidence: undefined,
                    metadata: {
                        model: undefined,
                        provider: undefined,
                        usage: undefined,
                        systemPrompt: undefined,
                        userPrompt: undefined,
                        ...response.metadata,
                    },
                    renderInChat: undefined,
                };

                // Use the existing publishResponse method
                await this.publishResponse(
                    originalEvent,
                    agentResponse,
                    agent,
                    originalEvent.kind === EVENT_KINDS.TASK
                );

                logger.info(`Published response from ${response.agentName}`);
            } catch (error) {
                logger.error(`Failed to publish response from ${response.agentName}: ${error}`);
            }
        }
    }

    /**
     * Add project reference to an event
     */
    private async addProjectReference(event: NDKEvent): Promise<void> {
        if (!this.projectInfo?.projectEvent) {
            throw new Error(
                "Project event is required for tenex run - cannot proceed without project context"
            );
        }

        try {
            // Try alternative approach - manually add the 'a' tag
            const dTag = this.projectInfo.projectEvent.tagValue("d");
            if (dTag) {
                event.tags.push([
                    "a",
                    `${this.projectInfo.projectEvent.kind}:${this.projectInfo.projectEvent.pubkey}:${dTag}`,
                ]);
            } else {
                // Fallback to using tag method
                event.tag(this.projectInfo.projectEvent);
            }
        } catch (tagError) {
            logger.error(`Error tagging event: ${tagError}`);
            if (this.projectInfo.projectEvent) {
                logger.error(
                    `Project event type: ${this.projectInfo.projectEvent.constructor.name}`
                );
                logger.error(`Project event id: ${this.projectInfo.projectEvent.id}`);
                logger.error(`Project event kind: ${this.projectInfo.projectEvent.kind}`);
                logger.error(`Project event pubkey: ${this.projectInfo.projectEvent.pubkey}`);
                if (typeof this.projectInfo.projectEvent.inspect === "function") {
                    logger.error(
                        `Project event inspect: ${this.projectInfo.projectEvent.inspect()}`
                    );
                }
            }
            throw tagError;
        }
    }

    /**
     * Add LLM metadata tags to an event
     */
    private addLLMMetadata(event: NDKEvent, response: AgentResponse): void {
        const metadata = response.metadata;
        if (!metadata) return;

        // Add model and provider
        if (metadata.model) {
            event.tags.push(["llm-model", metadata.model]);
        }
        if (metadata.provider) {
            event.tags.push(["llm-provider", metadata.provider]);
        }

        // Add token usage if available
        const usage = metadata.usage;
        if (usage) {
            if (usage.prompt_tokens) {
                event.tags.push(["llm-input-tokens", String(usage.prompt_tokens)]);
            }
            if (usage.completion_tokens) {
                event.tags.push(["llm-output-tokens", String(usage.completion_tokens)]);
            }
            if (usage.total_tokens) {
                event.tags.push(["llm-total-tokens", String(usage.total_tokens)]);
            }
            if (usage.cache_read_input_tokens) {
                event.tags.push(["llm-cache-read-tokens", String(usage.cache_read_input_tokens)]);
            }
            if (usage.cost) {
                event.tags.push(["llm-cost", String(usage.cost)]);
            }
        }

        // Add confidence if available
        if (response.confidence !== undefined) {
            event.tags.push(["llm-confidence", String(response.confidence)]);
        }

        // Add additional metadata
        if (metadata.temperature !== undefined) {
            event.tags.push(["llm-temperature", String(metadata.temperature)]);
        }
        if (metadata.maxTokens !== undefined) {
            event.tags.push(["llm-max-tokens", String(metadata.maxTokens)]);
        }
        if (metadata.toolCalls !== undefined) {
            event.tags.push(["llm-tool-calls", String(metadata.toolCalls)]);
        }
    }

    /**
     * Update project info (useful for dependency injection)
     */
    updateProjectInfo(projectInfo: ProjectRuntimeInfo): void {
        this.projectInfo = projectInfo;
    }
}
