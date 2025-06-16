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

interface ParallelExecution {
    agentName: string;
    startTime: number;
    endTime?: number;
    result?: AgentResponse;
    error?: Error;
}

export class ParallelExecutionStrategy implements OrchestrationStrategy {
    constructor(private readonly logger: Logger) {
        if (!logger) throw new Error("Logger is required");
    }

    async execute(
        team: Team,
        event: NDKEvent,
        agents: Map<string, Agent>,
        conversationStorage: ConversationStorage
    ): Promise<StrategyExecutionResult> {
        this.logger.info(`Executing ParallelExecutionStrategy for task ${team.taskDefinition.id}`);

        try {
            // Create conversation for this task
            const conversation = await conversationStorage.createConversation({
                projectNaddr: undefined,
                taskId: team.taskDefinition.id,
                agentName: undefined, // No specific agent owns this conversation
                metadata: {
                    orchestration: {
                        team,
                        strategy: "PARALLEL_EXECUTION",
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
                    conversation.id,
                    team.taskDefinition.id,
                    execution,
                    conversationStorage
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

                // Update conversation metadata
                await conversationStorage.updateConversationMetadata(conversation.id, {
                    completedAt: Date.now(),
                    status: "completed",
                    parallelExecutions: parallelExecutions.map((e) => ({
                        agent: e.agentName,
                        duration: e.endTime ? e.endTime - e.startTime : undefined,
                        success: !!e.result,
                        error: e.error?.message,
                    })),
                    aggregatedContent,
                });

                this.logger.info(
                    `ParallelExecutionStrategy completed with ${responses.length} successful and ${errors.length} failed executions`
                );

                return {
                    success: true,
                    responses,
                    errors: errors.length > 0 ? errors : undefined,
                    metadata: {
                        conversationId: conversation.id,
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

            await conversationStorage.updateConversationMetadata(conversation.id, {
                completedAt: Date.now(),
                status: "failed",
                errors: errors.map((e) => e.message),
            });

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
        content: string,
        conversationId: string,
        taskId: string,
        execution: ParallelExecution,
        conversationStorage: ConversationStorage
    ): Promise<void> {
        try {
            this.logger.debug(`Agent ${agent.name} starting parallel execution`);

            const result = await agent.processRequest({
                content,
                conversationId,
                metadata: {
                    taskId,
                    strategy: "PARALLEL_EXECUTION",
                    parallelExecution: true,
                },
            });

            execution.endTime = Date.now();
            execution.result = {
                agentName: agent.name,
                response: result.content,
                timestamp: Date.now(),
                metadata: result.metadata,
            };

            // Add agent response to conversation
            await conversationStorage.addMessage(conversationId, {
                role: "assistant",
                content: result.content,
                timestamp: Date.now(),
                metadata: { ...result.metadata, agentName: agent.name },
            });

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
