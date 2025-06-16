import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { Agent } from "../../../utils/agents/Agent";
import type { ConversationStorage } from "../../../utils/agents/ConversationStorage";
import type { Logger } from "../../../utils/fs";
import type { Team } from "../types";
import type {
    AgentResponse,
    OrchestrationStrategy,
    StrategyExecutionResult,
} from "./OrchestrationStrategy";

export class SingleResponderStrategy implements OrchestrationStrategy {
    constructor(private readonly logger: Logger) {
        if (!logger) throw new Error("Logger is required");
    }

    async execute(
        team: Team,
        event: NDKEvent,
        agents: Map<string, Agent>,
        conversationStorage: ConversationStorage
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

            // Create conversation for this task
            const conversation = await conversationStorage.createConversation({
                projectNaddr: undefined, // Will be set by the calling context
                taskId: team.taskDefinition.id,
                agentName: team.lead,
                metadata: {
                    orchestration: {
                        team,
                        strategy: "SINGLE_RESPONDER",
                    },
                },
            });

            // Add the incoming request to conversation
            await conversationStorage.addMessage(conversation.id, {
                role: "user",
                content: event.content,
                timestamp: Date.now(),
                metadata: {
                    eventId: event.id,
                },
            });

            this.logger.debug(`Agent ${team.lead} processing request`);

            // Process the request with the single agent
            const agentResult = await leadAgent.processRequest({
                content: event.content,
                conversationId: conversation.id,
                metadata: {
                    taskId: team.taskDefinition.id,
                    strategy: "SINGLE_RESPONDER",
                },
            });

            // Add agent response to conversation
            await conversationStorage.addMessage(conversation.id, {
                role: "assistant",
                content: agentResult.content,
                timestamp: Date.now(),
                metadata: agentResult.metadata,
            });

            // Update conversation metadata with completion
            await conversationStorage.updateConversationMetadata(conversation.id, {
                completedAt: Date.now(),
                status: "completed",
            });

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
                    conversationId: conversation.id,
                    executionTime: Date.now() - conversation.createdAt,
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
