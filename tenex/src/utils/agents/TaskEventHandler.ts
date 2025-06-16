import type { Agent } from "@/utils/agents/Agent";
import type { SystemPromptContext } from "@/utils/agents/prompts/types";
import { formatError } from "@/utils/errors";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import chalk from "chalk";

export class TaskEventHandler {
    constructor(
        private agents: Map<string, Agent>,
        private buildSystemPromptContextFn: (
            agentName: string,
            isAgentToAgent: boolean
        ) => Promise<Partial<SystemPromptContext>>
    ) {}

    async handleTaskEvent(event: NDKEvent): Promise<void> {
        try {
            logger.info(`Received task: "${event.content?.slice(0, 50)}..."`);

            // Extract task ID from event tags
            const taskId = event.id;

            // Add task to all agent conversations for context
            await this.addTaskToAllAgentConversations(event, taskId);

            logger.info(`📋 New Task Added - ID: ${taskId}`);
            logger.info(`Task Content: ${event.content?.slice(0, 100)}...`);
        } catch (err) {
            const errorMessage = formatError(err);
            logger.error(`Failed to handle task event: ${errorMessage}`);
        }
    }

    private async addTaskToAllAgentConversations(event: NDKEvent, taskId: string): Promise<void> {
        for (const [name, agent] of this.agents) {
            try {
                const context = await this.buildSystemPromptContextFn(name, false);
                const conversation = await agent.getOrCreateConversationWithContext(
                    taskId,
                    context
                );

                conversation.addMessage({
                    role: "user",
                    content: `New task: ${event.content}`,
                    timestamp: (event.created_at || Math.floor(Date.now() / 1000)) * 1000,
                    eventId: event.id,
                    pubkey: event.pubkey,
                });

                await conversation.save();
                logger.info(`Added task to ${name} agent's conversation history for context`);
            } catch (err) {
                const errorMessage = formatError(err);
                logger.warn(`Failed to add task to ${name} agent: ${errorMessage}`);
            }
        }
    }
}
