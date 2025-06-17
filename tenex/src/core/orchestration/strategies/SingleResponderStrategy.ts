import type {
    AgentResponse,
    OrchestrationStrategy,
    StrategyExecutionResult,
} from "@/core/orchestration/strategies/OrchestrationStrategy";
import type { Team } from "@/core/orchestration/types";
import type { Agent } from "@/utils/agents/Agent";
import type { ConversationStorage } from "@/utils/agents/ConversationStorage";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { AgentLogger } from "@tenex/shared/logger";

export class SingleResponderStrategy implements OrchestrationStrategy {
    constructor(private readonly logger: AgentLogger) {
        if (!logger) throw new Error("Logger is required");
    }

    async execute(
        team: Team,
        event: NDKEvent,
        agents: Map<string, Agent>,
        _conversationStorage: ConversationStorage
    ): Promise<StrategyExecutionResult> {
        this.logger.info(`Executing SingleResponderStrategy for task ${team.taskDefinition.id}`);

        try {
            // Get the lead agent (which is the only agent in single responder strategy)
            const leadAgent = agents.get(team.lead);
            if (!leadAgent) {
                const error = new Error(`Lead agent ${team.lead} not found`);
                this.logger.error(error.message);
                return {
                    success: false,
                    responses: [],
                    errors: [error],
                };
            }

            // Create conversation through the agent system
            const conversationId = team.conversationId;
            const conversation = await leadAgent.getOrCreateConversationWithContext(
                conversationId,
                {
                    agentRole: leadAgent.config.role || "Assistant",
                    projectName: leadAgent.config.name,
                    orchestrationMetadata: {
                        team,
                        strategy: "SINGLE_RESPONDER",
                    },
                }
            );

            // Add the incoming request to conversation
            conversation.addUserMessage(event.content, event);

            this.logger.debug(`Agent ${team.lead} processing request`);

            // Process the request with the single agent
            const agentResult = await leadAgent.generateResponse(
                conversation.getId(),
                undefined, // Use default LLM config
                undefined, // No specific project path
                false, // Not from agent
                undefined // No typing indicator callback
            );

            // Add agent response to conversation
            conversation.addAssistantMessage(agentResult.content);

            // Save the conversation
            await leadAgent.saveConversationToStorage(conversation);

            const response: AgentResponse = {
                agentName: team.lead,
                response: agentResult.content,
                timestamp: Date.now(),
                metadata: agentResult.metadata,
            };

            this.logger.info(
                `SingleResponderStrategy completed successfully for task ${team.taskDefinition.id}`
            );

            return {
                success: true,
                responses: [response],
                metadata: {
                    conversationId: conversation.getId(),
                    executionTime: Date.now() - conversation.getLastActivityTime(),
                },
            };
        } catch (error) {
            this.logger.error(`SingleResponderStrategy failed: ${error}`);
            return {
                success: false,
                responses: [],
                errors: [error instanceof Error ? error : new Error(String(error))],
            };
        }
    }

    getName(): string {
        return "SingleResponderStrategy";
    }

    getDescription(): string {
        return "A single agent handles the entire request independently without coordination needs";
    }
}
