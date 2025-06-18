import { logger } from "@tenex/shared/logger";
import { TeamFormationError } from "../core/errors";
import type {
    AgentConfig,
    ConversationPlan,
    LLMProvider,
    TeamFormationRequest,
    TeamFormationResult,
} from "../core/types";

export class TeamOrchestrator {
    constructor(private llm: LLMProvider) {}

    async formTeam(request: TeamFormationRequest): Promise<TeamFormationResult> {
        logger.info("TeamOrchestrator: Analyzing request and forming team");

        const prompt = this.buildTeamFormationPrompt(request);

        try {
            const completion = await this.llm.complete({
                messages: [
                    {
                        role: "system",
                        content: this.getSystemPrompt(),
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                context: {
                    agentName: "orchestrator",
                    conversationId: "team-formation",
                    eventId: request.event.id,
                },
                temperature: 0.7,
            });

            const response = this.parseTeamFormationResponse(completion.content);

            // Validate response
            this.validateTeamFormation(response, request.availableAgents);

            logger.info(
                `Team formation complete: Lead=${response.team.lead}, Members=${response.team.members.join(",")}`
            );

            return response;
        } catch (error) {
            logger.error("Team formation failed:", error);
            throw new TeamFormationError(
                `Failed to form team: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }

    private getSystemPrompt(): string {
        return `You are an expert team orchestrator for a multi-agent AI system. Your job is to analyze user requests and form optimal teams to handle them.

When forming teams:
1. Select a team lead who will coordinate the conversation
2. Choose team members based on the expertise required
3. Design a conversation plan with clear stages
4. Each stage should have specific participants, purpose, and transition criteria

You must respond in valid JSON format with this structure:
{
    "team": {
        "lead": "agent_name",
        "members": ["agent1", "agent2", "agent3"]
    },
    "conversationPlan": {
        "stages": [
            {
                "participants": ["agent1", "agent2"],
                "purpose": "Define requirements and approach",
                "expectedOutcome": "Clear specification of what needs to be built",
                "transitionCriteria": "When both agents agree on the approach"
            }
        ],
        "estimatedComplexity": 5
    },
    "reasoning": "Explanation of why this team and plan were chosen"
}`;
    }

    private buildTeamFormationPrompt(request: TeamFormationRequest): string {
        const agentDescriptions = Array.from(request.availableAgents.entries())
            .map(([name, config]) => `- ${name}: ${config.role} - ${config.instructions}`)
            .join("\n");

        return `User Request: "${request.event.content}"

Project Context:
- Title: ${request.projectContext.title}
- Description: ${request.projectContext.description || "N/A"}
- Repository: ${request.projectContext.repository || "N/A"}

Available Agents:
${agentDescriptions}

Form an optimal team to handle this request. Consider:
1. What expertise is needed?
2. Who should lead the conversation?
3. What stages should the conversation go through?
4. When should different agents participate?

Respond with a team composition and conversation plan in JSON format.`;
    }

    private parseTeamFormationResponse(content: string): TeamFormationResult {
        try {
            // Extract JSON from the response (handle markdown code blocks)
            const jsonMatch = content.match(/```json\n?(.*?)\n?```/s) || content.match(/{.*}/s);
            if (!jsonMatch) {
                throw new Error("No JSON found in response");
            }

            const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);

            // Validate structure
            if (!parsed.team || !parsed.team.lead || !Array.isArray(parsed.team.members)) {
                throw new Error("Invalid team structure");
            }

            if (!parsed.conversationPlan || !Array.isArray(parsed.conversationPlan.stages)) {
                throw new Error("Invalid conversation plan structure");
            }

            return {
                team: {
                    lead: parsed.team.lead,
                    members: parsed.team.members,
                },
                conversationPlan: {
                    stages: parsed.conversationPlan.stages,
                    estimatedComplexity: parsed.conversationPlan.estimatedComplexity || 5,
                },
                reasoning: parsed.reasoning || "No reasoning provided",
            };
        } catch (error) {
            throw new TeamFormationError(
                `Failed to parse team formation response: ${error instanceof Error ? error.message : "Unknown error"}`,
                { rawContent: content }
            );
        }
    }

    private validateTeamFormation(
        response: TeamFormationResult,
        availableAgents: Map<string, AgentConfig>
    ): void {
        // Check that lead exists
        if (!availableAgents.has(response.team.lead)) {
            throw new TeamFormationError(
                `Team lead '${response.team.lead}' not found in available agents`
            );
        }

        // Check that all members exist
        for (const member of response.team.members) {
            if (!availableAgents.has(member)) {
                throw new TeamFormationError(
                    `Team member '${member}' not found in available agents`
                );
            }
        }

        // Ensure lead is included in members
        if (!response.team.members.includes(response.team.lead)) {
            response.team.members.unshift(response.team.lead);
            logger.info(`Automatically added team lead '${response.team.lead}' to team members`);
        }

        // Validate conversation plan
        if (response.conversationPlan.stages.length === 0) {
            throw new TeamFormationError("Conversation plan must have at least one stage");
        }

        // Validate each stage
        for (const stage of response.conversationPlan.stages) {
            if (!stage.participants || stage.participants.length === 0) {
                throw new TeamFormationError("Each stage must have at least one participant");
            }

            // Check that stage participants are team members
            for (const participant of stage.participants) {
                if (!response.team.members.includes(participant)) {
                    throw new TeamFormationError(
                        `Stage participant '${participant}' is not a team member`
                    );
                }
            }
        }
    }
}
