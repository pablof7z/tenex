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

interface Phase {
    name: string;
    description: string;
    agents: string[];
    deliverables: string[];
}

export class PhasedDeliveryStrategy implements OrchestrationStrategy {
    constructor(private readonly logger: AgentLogger) {
        if (!logger) throw new Error("Logger is required");
    }

    async execute(
        team: Team,
        event: NDKEvent,
        agents: Map<string, Agent>,
        _conversationStorage: ConversationStorage
    ): Promise<StrategyExecutionResult> {
        this.logger.info(`Executing PhasedDeliveryStrategy for task ${team.taskDefinition.id}`);

        try {
            // Get the lead agent who will coordinate phases
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
                    agentRole: leadAgent.config.role || "Phase Coordinator",
                    projectName: leadAgent.config.name,
                    orchestrationMetadata: {
                        team,
                        strategy: "PHASED_DELIVERY",
                    },
                }
            );

            // Add the incoming request to conversation
            conversation.addUserMessage(event.content, event);

            const responses: AgentResponse[] = [];
            const startTime = Date.now();

            // Step 1: Lead agent creates phase plan
            this.logger.debug(`Lead agent ${team.lead} creating phase plan`);
            const planningRequest = `As the phase coordinator, analyze this complex request and break it down into deliverable phases. Each phase should have clear deliverables and specify which team members should be involved.

Team members available: ${team.members.filter((m) => m !== team.lead).join(", ")}

Request: ${event.content}

Create a structured phase plan with:
1. Phase name and description
2. Which agents should work on this phase
3. Expected deliverables
4. Dependencies on previous phases`;

            // Add the planning request to conversation
            conversation.addUserMessage(planningRequest);

            const planResult = await leadAgent.generateResponse(
                conversation.getId(),
                undefined, // Use default LLM config
                undefined, // No specific project path
                false, // Not from agent
                undefined // No typing indicator callback
            );

            // Add phase plan to conversation
            conversation.addAssistantMessage(planResult.content);

            responses.push({
                agentName: team.lead,
                response: planResult.content,
                timestamp: Date.now(),
                metadata: { phase: "planning", ...planResult.metadata },
            });

            // Extract phases from lead response
            const phases = this.extractPhases(
                planResult,
                team.members.filter((m) => m !== team.lead)
            );

            // Step 2: Execute phases sequentially
            const phaseResults: Map<string, string[]> = new Map();
            const partialFailures: Error[] = [];

            for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex++) {
                const phase = phases[phaseIndex];
                this.logger.debug(`Executing phase ${phaseIndex + 1}: ${phase.name}`);

                const phaseResponses: AgentResponse[] = [];

                // Execute work with agents assigned to this phase
                for (const agentName of phase.agents) {
                    const phaseAgent = agents.get(agentName);
                    if (!phaseAgent) {
                        this.logger.warn(`Phase agent ${agentName} not found, skipping`);
                        partialFailures.push(new Error(`Agent ${agentName} not found`));
                        continue;
                    }

                    try {
                        // Prepare phase context including previous phase results
                        const previousPhases = Array.from(phaseResults.entries())
                            .map(([phaseName, results]) => `${phaseName}:\n${results.join("\n")}`)
                            .join("\n\n");

                        const phaseContext = previousPhases
                            ? `Previous phase results:\n${previousPhases}\n\n`
                            : "";

                        const phaseTask = `${phaseContext}Current phase: ${phase.name}
Description: ${phase.description}
Expected deliverables: ${phase.deliverables.join(", ")}

Please complete your part of this phase.`;

                        // Each agent needs their own conversation context for the phase
                        const phaseConversation =
                            await phaseAgent.getOrCreateConversationWithContext(
                                `${conversation.getId()}-phase${phaseIndex + 1}-${agentName}`,
                                {
                                    agentRole: phaseAgent.config.role || "Phase Contributor",
                                    projectName: phaseAgent.config.name,
                                    orchestrationMetadata: {
                                        team,
                                        strategy: "PHASED_DELIVERY",
                                        phase: phase.name,
                                        phaseIndex: phaseIndex + 1,
                                        totalPhases: phases.length,
                                    },
                                }
                            );

                        phaseConversation.addUserMessage(phaseTask);

                        const phaseResult = await phaseAgent.generateResponse(
                            phaseConversation.getId(),
                            undefined, // Use default LLM config
                            undefined, // No specific project path
                            false, // Not from agent
                            undefined // No typing indicator callback
                        );

                        // Add phase response to main conversation
                        conversation.addAssistantMessage(
                            `[Phase ${phaseIndex + 1} - ${phase.name}] ${agentName}: ${phaseResult.content}`
                        );

                        const phaseResponse: AgentResponse = {
                            agentName,
                            response: phaseResult.content,
                            timestamp: Date.now(),
                            metadata: {
                                phase: `phase_${phaseIndex + 1}`,
                                phaseName: phase.name,
                                ...phaseResult.metadata,
                            },
                        };

                        phaseResponses.push(phaseResponse);
                        responses.push(phaseResponse);
                    } catch (error) {
                        this.logger.error(
                            `Agent ${agentName} failed in phase ${phase.name}: ${error}`
                        );
                        partialFailures.push(
                            error instanceof Error ? error : new Error(String(error))
                        );
                    }
                }

                // Store phase results for next phase
                phaseResults.set(
                    phase.name,
                    phaseResponses.map((r) => `${r.agentName}: ${r.response}`)
                );

                // Lead reviews phase completion
                if (phaseResponses.length > 0) {
                    const phaseReviewRequest = `Review the completion of phase ${phaseIndex + 1} (${phase.name}):

${phaseResponses.map((r) => `${r.agentName}: ${r.response}`).join("\n\n")}

Confirm if the phase deliverables have been met and we can proceed to the next phase.`;

                    conversation.addUserMessage(phaseReviewRequest);

                    const phaseReview = await leadAgent.generateResponse(
                        conversation.getId(),
                        undefined,
                        undefined,
                        false,
                        undefined
                    );

                    conversation.addAssistantMessage(phaseReview.content);

                    responses.push({
                        agentName: team.lead,
                        response: phaseReview.content,
                        timestamp: Date.now(),
                        metadata: {
                            phase: `phase_${phaseIndex + 1}_review`,
                            phaseName: `${phase.name} Review`,
                            ...phaseReview.metadata,
                        },
                    });
                }
            }

            // Step 3: Final integration and delivery
            this.logger.debug("Lead agent creating final integrated delivery");
            const integrationRequest = `Review all phase deliverables and create a final integrated response that addresses the original request:

${Array.from(phaseResults.entries())
    .map(([phaseName, results]) => `Phase: ${phaseName}\n${results.join("\n")}`)
    .join("\n\n")}

Original request: ${event.content}

Provide a comprehensive final response that integrates all phase deliverables.`;

            conversation.addUserMessage(integrationRequest);

            const finalResult = await leadAgent.generateResponse(
                conversation.getId(),
                undefined,
                undefined,
                false,
                undefined
            );

            conversation.addAssistantMessage(finalResult.content);

            responses.push({
                agentName: team.lead,
                response: finalResult.content,
                timestamp: Date.now(),
                metadata: { phase: "final_integration", ...finalResult.metadata },
            });

            // Save conversation
            await leadAgent.saveConversationToStorage(conversation);

            this.logger.info(
                `PhasedDeliveryStrategy completed successfully for task ${team.taskDefinition.id}`
            );

            return {
                success: true,
                responses,
                metadata: {
                    conversationId: conversation.getId(),
                    executionTime: Date.now() - startTime,
                    phases: phases.map((p) => ({
                        name: p.name,
                        agents: p.agents,
                        deliverables: p.deliverables,
                    })),
                    phaseCount: phases.length,
                    partialFailures:
                        partialFailures.length > 0
                            ? partialFailures.map((e) => e.message)
                            : undefined,
                },
            };
        } catch (error) {
            this.logger.error(`PhasedDeliveryStrategy failed: ${error}`);
            return {
                success: false,
                responses: [],
                errors: [error instanceof Error ? error : new Error(String(error))],
            };
        }
    }

    private extractPhases(
        planResult: { metadata?: { phases?: Phase[] } },
        members: string[]
    ): Phase[] {
        // Try to extract phases from metadata if available
        if (planResult.metadata?.phases) {
            return planResult.metadata.phases;
        }

        // Otherwise create default phases for complex delivery
        const phases: Phase[] = [
            {
                name: "Analysis & Design",
                description: "Analyze requirements and create initial design",
                agents: members.slice(0, Math.ceil(members.length / 3)),
                deliverables: ["Requirements analysis", "System design", "Architecture decisions"],
            },
            {
                name: "Core Implementation",
                description: "Implement core functionality",
                agents: members.slice(0, Math.ceil(members.length * 0.6)),
                deliverables: ["Core features", "Basic functionality", "Initial tests"],
            },
            {
                name: "Integration & Enhancement",
                description: "Integrate components and add advanced features",
                agents: members.slice(Math.ceil(members.length / 3)),
                deliverables: [
                    "Component integration",
                    "Advanced features",
                    "Performance optimization",
                ],
            },
            {
                name: "Testing & Finalization",
                description: "Complete testing and finalize deliverables",
                agents: members,
                deliverables: ["Comprehensive tests", "Documentation", "Final delivery"],
            },
        ];

        return phases;
    }

    getName(): string {
        return "PhasedDeliveryStrategy";
    }

    getDescription(): string {
        return "Complex tasks are broken into sequential phases with deliverables, each phase building on the previous";
    }
}
