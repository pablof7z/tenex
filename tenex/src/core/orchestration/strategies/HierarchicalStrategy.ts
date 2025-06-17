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

interface Delegation {
    agent: string;
    task: string;
}

export class HierarchicalStrategy implements OrchestrationStrategy {
    constructor(private readonly logger: AgentLogger) {
        if (!logger) throw new Error("Logger is required");
    }

    async execute(
        team: Team,
        event: NDKEvent,
        agents: Map<string, Agent>,
        _conversationStorage: ConversationStorage
    ): Promise<StrategyExecutionResult> {
        this.logger.info(`Executing HierarchicalStrategy for team ${team.id}`);

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

            // Create conversation through the lead agent
            const conversationId = team.conversationId || team.id;
            const conversation = await leadAgent.getOrCreateConversationWithContext(
                conversationId,
                {
                    agentName: leadAgent.getName(),
                    agentConfig: leadAgent.getConfig(),
                }
            );

            // Add the incoming request to conversation
            conversation.addUserMessage(event.content, event);

            const responses: AgentResponse[] = [];
            const startTime = Date.now();

            // Step 1: Lead agent analyzes and creates delegation plan
            this.logger.debug(`Lead agent ${team.lead} analyzing request`);
            const analysisRequest = `As the team lead, analyze this request and create a delegation plan for your team members: ${team.members.filter((m) => m !== team.lead).join(", ")}.\n\nRequest: ${event.content}\n\nProvide specific subtasks for each team member.`;

            // Add the analysis request to conversation
            conversation.addUserMessage(analysisRequest);

            const analysisResult = await leadAgent.generateResponse(
                conversation.getId(),
                undefined, // Use default LLM config
                undefined, // No specific project path
                false, // Not from agent
                undefined // No typing indicator callback
            );

            // Add lead analysis to conversation
            conversation.addAssistantMessage(analysisResult.content);

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
                    this.logger.warning(`Member agent ${delegation.agent} not found, skipping`);
                    partialFailures.push(new Error(`Agent ${delegation.agent} not found`));
                    continue;
                }

                try {
                    this.logger.debug(`Delegating to ${delegation.agent}: ${delegation.task}`);

                    // Each member needs their own conversation context for delegation
                    const memberConversation = await memberAgent.getOrCreateConversationWithContext(
                        `${conversation.getId()}-${delegation.agent}`,
                        {
                            agentName: memberAgent.getName(),
                            agentConfig: memberAgent.getConfig(),
                        }
                    );

                    memberConversation.addUserMessage(delegation.task);

                    const memberResult = await memberAgent.generateResponse(
                        memberConversation.getId(),
                        undefined, // Use default LLM config
                        undefined, // No specific project path
                        false, // Not from agent
                        undefined // No typing indicator callback
                    );

                    // Add member response to conversation
                    conversation.addAssistantMessage(memberResult.content);

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

            // Add the review request to conversation
            conversation.addUserMessage(reviewRequest);

            const reviewResult = await leadAgent.generateResponse(
                conversation.getId(),
                undefined, // Use default LLM config
                undefined, // No specific project path
                false, // Not from agent
                undefined // No typing indicator callback
            );

            // Add final review to conversation
            conversation.addAssistantMessage(reviewResult.content);

            responses.push({
                agentName: team.lead,
                response: reviewResult.content,
                timestamp: Date.now(),
                metadata: { phase: "review", ...reviewResult.metadata },
            });

            // Save conversation
            await leadAgent.saveConversationToStorage(conversation);

            this.logger.info(
                `HierarchicalStrategy completed successfully for task ${team.taskDefinition.id}`
            );

            return {
                success: true,
                responses,
                metadata: {
                    conversationId: conversation.getId(),
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

    private extractDelegations(analysisResult: AgentResponse, members: string[]): Delegation[] {
        // Try to extract delegations from content if structured
        // For now, we'll create simple delegations for each member
        // TODO: Parse structured delegation info from the lead agent's response

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
