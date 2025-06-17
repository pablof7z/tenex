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

interface ParallelExecution {
    agentName: string;
    startTime: number;
    endTime?: number;
    result?: AgentResponse;
    error?: Error;
}

export class ParallelExecutionStrategy implements OrchestrationStrategy {
    constructor(private readonly logger: AgentLogger) {
        if (!logger) throw new Error("Logger is required");
    }

    async execute(
        team: Team,
        event: NDKEvent,
        agents: Map<string, Agent>,
        _conversationStorage: ConversationStorage
    ): Promise<StrategyExecutionResult> {
        this.logger.info(`Executing ParallelExecutionStrategy for task ${team.taskDefinition.id}`);

        try {
            // Use the lead agent to create a coordination conversation
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

            // Create conversation through the lead agent
            const conversationId = team.conversationId;
            const conversation = await leadAgent.getOrCreateConversationWithContext(
                conversationId,
                {
                    agentRole: leadAgent.config.role || "Coordinator",
                    projectName: leadAgent.config.name,
                    orchestrationMetadata: {
                        team,
                        strategy: "PARALLEL_EXECUTION",
                    },
                }
            );

            // Add the incoming request to conversation
            conversation.addUserMessage(event.content, event);

            const startTime = Date.now();
            const parallelExecutions: ParallelExecution[] = [];
            const promises: Promise<void>[] = [];

            // Prepare parallel execution for each team member
            for (const memberName of team.members) {
                const agent = agents.get(memberName);
                if (!agent) {
                    this.logger.warn(`Agent ${memberName} not found, skipping`);
                    continue;
                }

                const execution: ParallelExecution = {
                    agentName: memberName,
                    startTime: Date.now(),
                };
                parallelExecutions.push(execution);

                // Create promise for this agent's execution
                const promise = this.executeAgent(
                    agent,
                    event.content,
                    conversation.getId(),
                    team.taskDefinition.id,
                    execution,
                    conversation
                );
                promises.push(promise);
            }

            this.logger.debug(`Starting parallel execution for ${promises.length} agents`);

            // Execute all agents in parallel
            await Promise.allSettled(promises);

            // Collect results
            const responses: AgentResponse[] = [];
            const errors: Error[] = [];

            for (const execution of parallelExecutions) {
                if (execution.result) {
                    responses.push(execution.result);
                }
                if (execution.error) {
                    errors.push(execution.error);
                }
            }

            // Determine success based on whether we have any successful responses
            const success = responses.length > 0;

            if (success) {
                // Aggregate content from all successful responses
                const aggregatedContent = responses
                    .map((r) => `${r.agentName}: ${r.response}`)
                    .join("\n\n");

                // Save conversation with all responses
                await leadAgent.saveConversationToStorage(conversation);

                this.logger.info(
                    `ParallelExecutionStrategy completed with ${responses.length} successful and ${errors.length} failed executions`
                );

                return {
                    success: true,
                    responses,
                    errors: errors.length > 0 ? errors : undefined,
                    metadata: {
                        conversationId: conversation.getId(),
                        executionTime: Date.now() - startTime,
                        parallelExecutions: parallelExecutions.map((e) => ({
                            agent: e.agentName,
                            duration: e.endTime ? e.endTime - e.startTime : undefined,
                            success: !!e.result,
                        })),
                        aggregatedContent,
                    },
                };
            }
            this.logger.error(
                `ParallelExecutionStrategy failed - all ${errors.length} agents failed`
            );

            // Save conversation with error information
            await leadAgent.saveConversationToStorage(conversation);

            return {
                success: false,
                responses: [],
                errors,
            };
        } catch (error) {
            this.logger.error(`ParallelExecutionStrategy failed: ${error}`);
            return {
                success: false,
                responses: [],
                errors: [error instanceof Error ? error : new Error(String(error))],
            };
        }
    }

    private async executeAgent(
        agent: Agent,
        _content: string,
        conversationId: string,
        _taskId: string,
        execution: ParallelExecution,
        conversation: any
    ): Promise<void> {
        try {
            this.logger.debug(`Agent ${agent.name} starting parallel execution`);

            const result = await agent.generateResponse(
                conversationId,
                undefined, // Use default LLM config
                undefined, // No specific project path
                false, // Not from agent
                undefined // No typing indicator callback
            );

            execution.endTime = Date.now();
            execution.result = {
                agentName: agent.name,
                response: result.content,
                timestamp: Date.now(),
                metadata: result.metadata,
            };

            // Add agent response to conversation
            conversation.addAssistantMessage(result.content);

            this.logger.debug(
                `Agent ${agent.name} completed in ${execution.endTime - execution.startTime}ms`
            );
        } catch (error) {
            execution.endTime = Date.now();
            execution.error = error instanceof Error ? error : new Error(String(error));
            this.logger.error(`Agent ${agent.name} failed: ${error}`);
        }
    }

    getName(): string {
        return "ParallelExecutionStrategy";
    }

    getDescription(): string {
        return "All team agents work simultaneously on independent subtasks with no dependencies";
    }
}
