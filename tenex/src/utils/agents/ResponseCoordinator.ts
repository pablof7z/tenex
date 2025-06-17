import type { StrategyExecutionResult } from "@/core/orchestration/strategies/OrchestrationStrategy";
import type { Agent } from "@/utils/agents/Agent";
import type { AgentConfigurationManager } from "@/utils/agents/AgentConfigurationManager";
import type { EnhancedResponsePublisher } from "@/utils/agents/EnhancedResponsePublisher";
import type { OrchestrationExecutionService } from "@/utils/agents/OrchestrationExecutionService";
import type { SystemPromptContextFactory } from "@/utils/agents/prompts/SystemPromptContextFactory";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import type { LLMConfig } from "@tenex/types/llm";

interface AgentSelectionResult {
    agents: Agent[];
    team?: any; // Team type from orchestration
}

/**
 * Coordinates agent responses to events
 * Extracted from AgentCommunicationHandler to improve maintainability
 */
export class ResponseCoordinator {
    constructor(
        private configManager: AgentConfigurationManager,
        private contextFactory: SystemPromptContextFactory,
        private responsePublisher: EnhancedResponsePublisher,
        private orchestrationExecutionService?: OrchestrationExecutionService,
        private isEventFromAnyAgentFn?: (eventPubkey: string) => Promise<boolean>
    ) {}

    /**
     * Coordinate responses from selected agents
     */
    async coordinateResponses(
        result: AgentSelectionResult,
        event: NDKEvent,
        conversationId: string,
        llmName?: string,
        isTaskEvent = false,
        _span?: any
    ): Promise<void> {
        // Use orchestration execution service if available, otherwise handle directly
        if (this.orchestrationExecutionService) {
            this.orchestrationExecutionService.logResultInfo(result);

            if (!this.orchestrationExecutionService.checkIfAgentsWillRespond(result)) {
                return;
            }

            const llmConfig = this.orchestrationExecutionService.getLLMConfigForEvent(llmName);
            if (!llmConfig) {
                return;
            }

            await this.orchestrationExecutionService.executeResponseStrategy(
                { agents: result.agents, team: result.team },
                event,
                conversationId,
                llmConfig,
                isTaskEvent,
                this.processAgentResponses.bind(this),
                null // ndk parameter - not needed for our callback
            );
        } else {
            // Fallback to legacy logic when no orchestration service available
            logger.info("🎯 Agent determination result:");
            logger.info(`   Agents to respond: ${result.agents.length}`);
            logger.info(`   Agent names: ${result.agents.map((a) => a.getName()).join(", ")}`);

            if (result.agents.length === 0) {
                logger.warn("❌ No agents will respond to this event - stopping processing");
                return;
            }

            const llmConfig = this.configManager.getLLMConfig(llmName);
            if (!llmConfig) {
                this.logLLMConfigError(llmName);
                return;
            }

            await this.processAgentResponses(
                result.agents,
                event,
                conversationId,
                llmConfig,
                isTaskEvent
            );
        }
    }

    /**
     * Process agent responses to an event
     */
    private async processAgentResponses(
        agents: Agent[],
        event: NDKEvent,
        conversationId: string,
        llmConfig: LLMConfig,
        isTaskEvent: boolean
    ): Promise<void> {
        // Have each agent respond to the event
        for (const agent of agents) {
            try {
                // Get agent-specific LLM config if available
                const agentLLMConfig =
                    this.configManager.getLLMConfigForAgent(agent.getName()) || llmConfig;

                // Extract system prompt and last message from conversation
                // Use getOrCreateConversationWithContext to ensure p-tagged agents can load conversations from storage
                const context = await this.contextFactory.createContext(agent, false);
                const conversation = await agent.getOrCreateConversationWithContext(
                    conversationId,
                    context
                );

                // Check if we need to add the user message to this agent's conversation
                // This handles cases where the agent wasn't in the agents Map when addEventToAllAgentConversations was called
                if (conversation && !isTaskEvent && agent.getPubkey() !== event.author.pubkey) {
                    const messages = conversation.getMessages();
                    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

                    // Only add the message if it's not already the last message in the conversation
                    if (!lastMessage || lastMessage.event?.id !== event.id) {
                        logger.debug(
                            ` Adding user message to ${agent.getName()}'s conversation: "${event.content}"`
                        );
                        conversation.addUserMessage(event.content, event);
                        // Save the updated conversation using agent's conversation manager
                        await agent.saveConversationToStorage(conversation);
                        logger.debug(
                            ` Updated conversation for ${agent.getName()}, now has ${conversation.getMessageCount()} messages`
                        );
                    } else {
                        logger.debug(
                            ` User message already exists in ${agent.getName()}'s conversation, skipping duplicate`
                        );
                    }
                }

                let systemPrompt: string | undefined;
                let lastUserMessage: string | undefined;

                if (conversation) {
                    const messages = conversation.getFormattedMessages();
                    // Find system prompt
                    const systemMessage = messages.find((msg) => msg.role === "system");
                    if (systemMessage) {
                        systemPrompt = systemMessage.content;

                        // Add tool information to system prompt if tools are available
                        const toolRegistry = agent.getToolRegistry();
                        if (toolRegistry) {
                            const availableTools = toolRegistry.getAllTools();
                            if (availableTools.length > 0) {
                                const toolPrompt = toolRegistry.generateSystemPrompt();
                                systemPrompt = `${systemPrompt}\n\n${toolPrompt}`;
                            }
                        }
                    }
                    // Get the last user message (which should be the current event)
                    const userMessages = messages.filter((msg) => msg.role === "user");
                    if (userMessages.length > 0) {
                        lastUserMessage = userMessages[userMessages.length - 1].content;
                    }
                }

                // Publish typing indicator with system prompt and user prompt
                await this.responsePublisher.publishTypingIndicator(
                    event,
                    agent,
                    true,
                    undefined,
                    systemPrompt,
                    lastUserMessage
                );

                // Create typing indicator callback
                const typingIndicatorCallback = async (message: string) => {
                    await this.responsePublisher.publishTypingIndicator(
                        event,
                        agent,
                        true,
                        message,
                        systemPrompt,
                        lastUserMessage
                    );
                };

                // Check if the event is from another agent
                const isFromAgent = this.isEventFromAnyAgentFn
                    ? await this.isEventFromAnyAgentFn(event.author.pubkey)
                    : false;

                // Generate response (the event is already in conversation history)
                const response = await agent.generateResponse(
                    conversationId,
                    agentLLMConfig,
                    this.configManager.getProjectPath(),
                    isFromAgent,
                    typingIndicatorCallback
                );

                // Only publish if agent has something meaningful to say
                // OR if the response contains renderInChat data (e.g., agent discovery results)
                if (
                    response.renderInChat ||
                    (!response.content.toLowerCase().includes("nothing to add") &&
                        response.content.trim().length > 0)
                ) {
                    // Add agent as participant in conversation
                    const conversation = agent.getConversation(conversationId);
                    if (conversation) {
                        conversation.addParticipant(agent.getPubkey());
                        await agent.saveConversationToStorage(conversation);
                    }

                    // Publish response to Nostr
                    await this.responsePublisher.publishResponse(
                        event,
                        response,
                        agent,
                        isTaskEvent
                    );
                    const eventType = isTaskEvent ? "Task" : "Chat";
                    logger.info(
                        `${eventType} response generated and published by agent '${agent.getName()}'`
                    );

                    // Stop typing indicator after publishing response
                    await this.responsePublisher.publishTypingIndicator(event, agent, false);
                } else {
                    logger.info(
                        `Agent '${agent.getName()}' had nothing to add to the ${isTaskEvent ? "task" : "conversation"}`
                    );

                    // Stop typing indicator since agent decided not to respond
                    await this.responsePublisher.publishTypingIndicator(event, agent, false);
                }
            } catch (error) {
                logger.error(
                    `Failed to generate response for agent '${agent.getName()}': ${error}`
                );

                // Stop typing indicator on error
                try {
                    await this.responsePublisher.publishTypingIndicator(event, agent, false);
                } catch (indicatorError) {
                    logger.error(`Failed to stop typing indicator: ${indicatorError}`);
                }
            }
        }
    }

    /**
     * Set the isEventFromAnyAgent function dependency
     */
    setIsEventFromAnyAgentFn(fn: (eventPubkey: string) => Promise<boolean>): void {
        this.isEventFromAnyAgentFn = fn;
    }

    /**
     * Log LLM configuration error (fallback when no orchestration service)
     */
    private logLLMConfigError(llmName?: string): void {
        logger.error("No LLM configuration available for response");
        logger.error(`Requested LLM: ${llmName || "default"}`);
        logger.error(
            `Available LLMs: ${Array.from(this.configManager.getAllLLMConfigs().keys()).join(", ")}`
        );
        logger.error(`Default LLM name: ${this.configManager.getDefaultLLMName()}`);
    }
}
