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

interface Delegation {
    agent: string;
    task: string;
}

export class HierarchicalStrategy implements OrchestrationStrategy {
    constructor(private readonly logger: Logger) {
        if (!logger) throw new Error("Logger is required");
    }

    async execute(
        team: Team,
        event: NDKEvent,
        agents: Map<string, Agent>,
        conversationStorage: ConversationStorage
    ): Promise<StrategyExecutionResult> {
        this.logger.info(`Executing HierarchicalStrategy for task ${team.taskDefinition.id}`);

        try {
            // Get the lead agent
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
                projectNaddr: undefined,
                taskId: team.taskDefinition.id,
                agentName: team.lead,
                metadata: {
                    orchestration: {
                        team,
                        strategy: "HIERARCHICAL",
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

            const responses: AgentResponse[] = [];
            const startTime = Date.now();

            // Step 1: Lead agent analyzes and creates delegation plan
            this.logger.debug(`Lead agent ${team.lead} analyzing request`);
            const analysisRequest = `As the team lead, analyze this request and create a delegation plan for your team members: ${team.members.filter((m) => m !== team.lead).join(", ")}.\n\nRequest: ${event.content}\n\nProvide specific subtasks for each team member.`;

            const analysisResult = await leadAgent.processRequest({
                content: analysisRequest,
                conversationId: conversation.id,
                metadata: {
                    taskId: team.taskDefinition.id,
                    strategy: "HIERARCHICAL",
                    phase: "analysis",
                },
            });

            // Add lead analysis to conversation
            await conversationStorage.addMessage(conversation.id, {
                role: "assistant",
                content: analysisResult.content,
                timestamp: Date.now(),
                metadata: { ...analysisResult.metadata, agentName: team.lead },
            });

            responses.push({
                agentName: team.lead,
                response: analysisResult.content,
                timestamp: Date.now(),
                metadata: { phase: "analysis", ...analysisResult.metadata },
            });

            // Extract delegations from lead response
            const delegations = this.extractDelegations(
                analysisResult,
                team.members.filter((m) => m !== team.lead)
            );

            // Step 2: Delegate tasks to team members
            const memberResponses: AgentResponse[] = [];
            const partialFailures: Error[] = [];

            for (const delegation of delegations) {
                const memberAgent = agents.get(delegation.agent);
                if (!memberAgent) {
                    this.logger.warn(`Member agent ${delegation.agent} not found, skipping`);
                    partialFailures.push(new Error(`Agent ${delegation.agent} not found`));
                    continue;
                }

                try {
                    this.logger.debug(`Delegating to ${delegation.agent}: ${delegation.task}`);

                    const memberResult = await memberAgent.processRequest({
                        content: delegation.task,
                        conversationId: conversation.id,
                        metadata: {
                            taskId: team.taskDefinition.id,
                            strategy: "HIERARCHICAL",
                            phase: "execution",
                            leadAgent: team.lead,
                        },
                    });

                    // Add member response to conversation
                    await conversationStorage.addMessage(conversation.id, {
                        role: "assistant",
                        content: memberResult.content,
                        timestamp: Date.now(),
                        metadata: { ...memberResult.metadata, agentName: delegation.agent },
                    });

                    const memberResponse: AgentResponse = {
                        agentName: delegation.agent,
                        response: memberResult.content,
                        timestamp: Date.now(),
                        metadata: { phase: "execution", ...memberResult.metadata },
                    };

                    memberResponses.push(memberResponse);
                    responses.push(memberResponse);
                } catch (error) {
                    this.logger.error(`Member ${delegation.agent} failed: ${error}`);
                    partialFailures.push(error instanceof Error ? error : new Error(String(error)));
                }
            }

            // Step 3: Lead reviews and integrates results
            this.logger.debug("Lead agent reviewing member responses");
            const reviewRequest = `Review and integrate the following responses from your team members:\n\n${memberResponses.map((r) => `${r.agentName}: ${r.response}`).join("\n\n")}\n\nProvide a final integrated response.`;

            const reviewResult = await leadAgent.processRequest({
                content: reviewRequest,
                conversationId: conversation.id,
                metadata: {
                    taskId: team.taskDefinition.id,
                    strategy: "HIERARCHICAL",
                    phase: "review",
                },
            });

            // Add final review to conversation
            await conversationStorage.addMessage(conversation.id, {
                role: "assistant",
                content: reviewResult.content,
                timestamp: Date.now(),
                metadata: { ...reviewResult.metadata, agentName: team.lead },
            });

            responses.push({
                agentName: team.lead,
                response: reviewResult.content,
                timestamp: Date.now(),
                metadata: { phase: "review", ...reviewResult.metadata },
            });

            // Update conversation metadata
            await conversationStorage.updateConversationMetadata(conversation.id, {
                completedAt: Date.now(),
                status: "completed",
                delegations,
                memberResponses: memberResponses.map((r) => ({
                    agent: r.agentName,
                    response: r.response,
                })),
                partialFailures:
                    partialFailures.length > 0 ? partialFailures.map((e) => e.message) : undefined,
            });

            this.logger.info(
                `HierarchicalStrategy completed successfully for task ${team.taskDefinition.id}`
            );

            return {
                success: true,
                responses,
                metadata: {
                    conversationId: conversation.id,
                    executionTime: Date.now() - startTime,
                    delegations,
                    partialFailures:
                        partialFailures.length > 0
                            ? partialFailures.map((e) => e.message)
                            : undefined,
                },
            };
        } catch (error) {
            this.logger.error(`HierarchicalStrategy failed: ${error}`);
            return {
                success: false,
                responses: [],
                errors: [error instanceof Error ? error : new Error(String(error))],
            };
        }
    }

    private extractDelegations(analysisResult: { metadata?: { subtasks?: Delegation[] } }, members: string[]): Delegation[] {
        // Try to extract delegations from metadata if available
        if (analysisResult.metadata?.subtasks) {
            return analysisResult.metadata.subtasks;
        }

        // Otherwise create simple delegations for each member
        const delegations: Delegation[] = [];
        for (const member of members) {
            delegations.push({
                agent: member,
                task: `Task 1 for ${member}: Please handle your part of the request based on your expertise.`,
            });
        }

        return delegations;
    }

    getName(): string {
        return "HierarchicalStrategy";
    }

    getDescription(): string {
        return "Team lead coordinates other members, delegating subtasks and reviewing their work";
    }
}
