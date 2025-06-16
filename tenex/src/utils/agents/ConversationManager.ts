import type { Agent } from "@/utils/agents/Agent";
import type { SystemPromptContextFactory } from "@/utils/agents/prompts/SystemPromptContextFactory";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";

/**
 * Manages conversation-related operations across agents
 * Extracted from AgentCommunicationHandler to improve maintainability
 */
export class ConversationManager {
    constructor(
        private agents: Map<string, Agent>,
        private contextFactory: SystemPromptContextFactory
    ) {}

    /**
     * Add event to all agent conversations for context tracking
     */
    async addEventToAllAgentConversations(
        event: NDKEvent,
        conversationId: string,
        isTaskEvent: boolean
    ): Promise<void> {
        logger.debug(
            `addEventToAllAgentConversations called with event content: "${event.content}"`
        );
        logger.debug(`conversationId: ${conversationId}`);
        logger.debug(`event author: ${event.author.pubkey}`);
        logger.debug(`number of agents: ${this.agents.size}`);

        for (const [name, agent] of this.agents) {
            logger.debug(` Processing agent: ${name}, agent pubkey: ${agent.getPubkey()}`);

            // Skip if this is the agent's own message
            if (agent.getPubkey() === event.author.pubkey) {
                if (!isTaskEvent) {
                    logger.debug(`Skipping adding event to ${name}'s own conversation`);
                }
                logger.debug(` Skipping agent ${name} - matches event author`);
                continue;
            }

            logger.debug(` Adding event to agent ${name}'s conversation`);
            const context = await this.contextFactory.createContext(agent, false);

            const conversation = await agent.getOrCreateConversationWithContext(
                conversationId,
                context
            );

            logger.debug(
                ` Got conversation for ${name}, current message count: ${conversation.getMessageCount()}`
            );
            logger.debug(` About to add user message: "${event.content}"`);
            conversation.addUserMessage(event.content, event);
            logger.debug(
                ` After adding user message, message count: ${conversation.getMessageCount()}`
            );

            // Save the conversation to persist the context using agent's conversation manager
            await agent.saveConversationToStorage(conversation);
            logger.debug(`Added event to ${name} agent's conversation history for context`);
        }
    }

    /**
     * Add task to all agent conversations with task-specific metadata
     */
    async addTaskToAllAgentConversations(
        event: NDKEvent,
        taskId: string,
        title: string,
        taskContent: string
    ): Promise<void> {
        for (const [name, agent] of this.agents) {
            // Skip if this is the agent's own message
            if (agent.getPubkey() === event.author.pubkey) {
                continue;
            }

            const context = await this.contextFactory.createContext(agent, false);

            const conversation = await agent.getOrCreateConversationWithContext(taskId, context);
            conversation.addUserMessage(taskContent, event);
            conversation.setMetadata("taskId", taskId);
            conversation.setMetadata("taskTitle", title);

            // Save the conversation to persist the context using agent's conversation manager
            await agent.saveConversationToStorage(conversation);
            logger.debug(`Added task to ${name} agent's conversation history for context`);
        }
    }

    /**
     * Update the agents Map after initialization
     */
    updateAgentsMap(agents: Map<string, Agent>): void {
        this.agents = agents;
    }
}
