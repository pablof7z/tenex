import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import chalk from "chalk";
import type { ProjectInfo } from "../../commands/run/ProjectLoader";
import { formatError } from "../errors";
import type { Agent } from "./Agent";
import type { SystemPromptContext } from "./prompts/types";

export class ChatEventHandler {
    constructor(
        private agents: Map<string, Agent>,
        private projectInfo: ProjectInfo,
        private getAgentFn: (name?: string) => Promise<Agent>,
        private isEventFromAnyAgentFn: (eventPubkey: string) => Promise<boolean>,
        private buildSystemPromptContextFn: (
            agentName: string,
            isAgentToAgent: boolean
        ) => Promise<Partial<SystemPromptContext>>,
        private determineRespondingAgentsFn: (event: NDKEvent) => Promise<string[]>,
        private processAgentResponsesFn: (
            agents: string[],
            event: NDKEvent,
            conversationId: string
        ) => Promise<void>
    ) {}

    async handleChatEvent(event: NDKEvent): Promise<void> {
        try {
            const conversationId = this.extractConversationId(event);
            const isFromAgent = await this.isEventFromAnyAgentFn(event.pubkey);

            if (isFromAgent) {
                logger.info(`Received agent message from ${event.pubkey.slice(0, 8)}...`);
            } else {
                logger.info(`Received user message: "${event.content?.slice(0, 50)}..."`);
            }

            // Always add the message to all agents' conversation contexts
            await this.addEventToAllAgentConversations(event, conversationId);

            // Don't respond to our own agents' messages
            if (isFromAgent) {
                return;
            }

            // Determine which agents should respond
            const respondingAgents = await this.determineRespondingAgentsFn(event);

            if (respondingAgents.length === 0) {
                logger.info("No agents selected to respond to this message");
                return;
            }

            // Process responses from selected agents
            await this.processAgentResponsesFn(respondingAgents, event, conversationId);
        } catch (err) {
            const errorMessage = formatError(err);
            logger.error(`Failed to handle chat event: ${errorMessage}`);
        }
    }

    private extractConversationId(event: NDKEvent): string {
        const eTag = event.tags.find((tag) => tag[0] === "e");
        return eTag?.[1] || event.id;
    }

    private async addEventToAllAgentConversations(
        event: NDKEvent,
        conversationId: string
    ): Promise<void> {
        for (const [name, agent] of this.agents) {
            try {
                const context = await this.buildSystemPromptContextFn(name, false);
                const conversation = await agent.getOrCreateConversationWithContext(
                    conversationId,
                    context
                );

                conversation.addMessage({
                    role: "user",
                    content: event.content || "",
                    timestamp: (event.created_at || Math.floor(Date.now() / 1000)) * 1000,
                    eventId: event.id,
                    pubkey: event.pubkey,
                });

                await conversation.save();
                logger.info(`Added message to ${name} agent's conversation history`);
            } catch (err) {
                const errorMessage = formatError(err);
                logger.warn(`Failed to add message to ${name} agent: ${errorMessage}`);
            }
        }
    }
}
