import type {
    Milestone,
    SupervisionContext,
    SupervisionDecision,
} from "@/core/orchestration/supervision/types";
import type { LLMProvider } from "@/core/orchestration/types";
import type { Agent } from "@/utils/agents/Agent";
import type { AgentLogger } from "@tenex/shared/logger";

export interface ISupervisorDecisionMaker {
    makeDecision(
        milestone: Milestone,
        supervisor: Agent,
        context: SupervisionContext
    ): Promise<SupervisionDecision>;

    shouldEscalate(milestone: Milestone, decision: SupervisionDecision): boolean;
}

export class SupervisorDecisionMaker implements ISupervisorDecisionMaker {
    private static readonly ESCALATION_CONFIDENCE_THRESHOLD = 0.6;

    constructor(
        private readonly logger: Logger,
        private readonly llmProvider: LLMProvider
    ) {
        if (!logger) throw new Error("Logger is required");
        if (!llmProvider) throw new Error("LLMProvider is required");
    }

    async makeDecision(
        milestone: Milestone,
        supervisor: Agent,
        context: SupervisionContext
    ): Promise<SupervisionDecision> {
        this.logger.debug(
            `Supervisor ${supervisor.name} making decision for milestone ${milestone.id}`
        );

        const prompt = this.buildDecisionPrompt(milestone, context);

        try {
            const response = await this.llmProvider.processRequest({
                model: "default",
                messages: [
                    {
                        role: "system",
                        content: `You are a technical supervisor reviewing milestone completion. 
                        You must respond with a JSON object containing:
                        - decision: "approve" | "reject" | "revise" | "escalate"
                        - confidence: number between 0 and 1
                        - reasoning: string explaining your decision
                        - recommendations: array of strings for next steps
                        - requiredActions: (optional) array of actions needed for rejected/revised milestones
                        - escalationReason: (optional) reason for escalation`,
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
            });

            const parsedDecision = this.parseDecisionResponse(response.content);

            const decision: SupervisionDecision = {
                ...parsedDecision,
                timestamp: Date.now(),
                supervisorId: supervisor.name,
            };

            this.logger.info(
                `Supervisor decision: ${decision.decision} with confidence ${decision.confidence}`
            );

            return decision;
        } catch (error) {
            this.logger.error(`Failed to make supervisor decision: ${error}`);
            throw new Error(`Failed to parse supervisor decision: ${error}`);
        }
    }

    shouldEscalate(milestone: Milestone, decision: SupervisionDecision): boolean {
        // Escalate if decision is explicitly to escalate
        if (decision.decision === "escalate") {
            this.logger.warn(
                `Escalation needed for milestone ${milestone.id}: ${decision.escalationReason || "No reason provided"}`
            );
            return true;
        }

        // Escalate if confidence is too low
        if (decision.confidence < SupervisorDecisionMaker.ESCALATION_CONFIDENCE_THRESHOLD) {
            this.logger.warn(
                `Escalation needed for milestone ${milestone.id}: Low confidence (${decision.confidence})`
            );
            return true;
        }

        return false;
    }

    private buildDecisionPrompt(milestone: Milestone, context: SupervisionContext): string {
        const previousDecisionsText = context.previousDecisions
            .map((d) => `- ${d.decision}: ${d.reasoning}`)
            .join("\n");

        return `Review the following milestone completion:

Milestone ID: ${milestone.id}
Task ID: ${milestone.taskId}
Agent: ${milestone.agentName}
Description: ${milestone.description}
Status: ${milestone.status}
Created: ${new Date(milestone.createdAt).toISOString()}
${milestone.completedAt ? `Completed: ${new Date(milestone.completedAt).toISOString()}` : "Not completed"}

Task Context:
- Overall Progress: ${(context.taskProgress * 100).toFixed(1)}%
- Team Success Rate: ${(context.teamPerformance.successRate * 100).toFixed(1)}%
- Average Completion Time: ${context.teamPerformance.averageCompletionTime}ms

${previousDecisionsText ? `Previous Decisions:\n${previousDecisionsText}` : "No previous decisions"}

Please review this milestone and provide your decision.`;
    }

    private parseDecisionResponse(
        content: string
    ): Omit<SupervisionDecision, "timestamp" | "supervisorId"> {
        try {
            const parsed = JSON.parse(content);

            // Validate required fields
            if (
                !parsed.decision ||
                !["approve", "reject", "revise", "escalate"].includes(parsed.decision)
            ) {
                throw new Error("Invalid or missing decision field");
            }

            if (
                typeof parsed.confidence !== "number" ||
                parsed.confidence < 0 ||
                parsed.confidence > 1
            ) {
                throw new Error("Invalid or missing confidence field");
            }

            if (!parsed.reasoning || typeof parsed.reasoning !== "string") {
                throw new Error("Invalid or missing reasoning field");
            }

            return {
                decision: parsed.decision,
                confidence: parsed.confidence,
                reasoning: parsed.reasoning,
                recommendations: parsed.recommendations || [],
                requiredActions: parsed.requiredActions,
                escalationReason: parsed.escalationReason,
            };
        } catch (error) {
            throw new Error(`Failed to parse decision response: ${error}`);
        }
    }
}
