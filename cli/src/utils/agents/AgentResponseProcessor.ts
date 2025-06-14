import type NDK from "@nostr-dev-kit/ndk";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import chalk from "chalk";
import { formatError } from "../errors";
import type { Agent } from "./Agent";
import type { SystemPromptContext } from "./prompts/types";

export class AgentResponseProcessor {
    constructor(
        private ndk: NDK,
        private publishTypingIndicatorFn: (
            agent: Agent,
            conversationId: string,
            isTyping: boolean,
            message?: string
        ) => Promise<void>,
        private publishResponseFn: (
            agent: Agent,
            response: string,
            originalEvent: NDKEvent,
            conversationId: string
        ) => Promise<void>
    ) {}

    async processAgentResponses(
        agentNames: string[],
        event: NDKEvent,
        conversationId: string,
        agents: Map<string, Agent>,
        buildSystemPromptContextFn: (agentName: string, isAgentToAgent: boolean) => Promise<Partial<SystemPromptContext>>
    ): Promise<void> {
        for (const agentName of agentNames) {
            const agent = agents.get(agentName);
            if (!agent) {
                logger.warn(`Agent ${agentName} not found in available agents`);
                continue;
            }

            try {
                logger.info(`🤖 ${agentName} is processing message...`);

                // Publish typing indicator
                await this.publishTypingIndicatorFn(
                    agent,
                    conversationId,
                    true,
                    "Processing message..."
                );

                // Build context for this agent
                const context = await buildSystemPromptContextFn(agentName, false);
                const conversation = await agent.getOrCreateConversationWithContext(
                    conversationId,
                    context
                );

                // Generate response
                const response = await conversation.generateResponse(event.content || "");

                // Stop typing indicator
                await this.publishTypingIndicatorFn(agent, conversationId, false);

                // Publish the response
                await this.publishResponseFn(agent, response.content, event, conversationId);

                logger.info(`✅ ${agentName} responded: "${response.content.slice(0, 50)}..."`);
            } catch (err) {
                const errorMessage = formatError(err);
                logger.error(`❌ ${agentName} failed: ${errorMessage}`);

                // Make sure to stop typing indicator on error
                try {
                    await this.publishTypingIndicatorFn(agent, conversationId, false);
                } catch {
                    // Ignore errors when stopping typing indicator
                }
            }
        }
    }
}
