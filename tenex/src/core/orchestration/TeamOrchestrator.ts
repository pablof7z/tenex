import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { TeamFormationAnalyzer } from "./TeamFormationAnalyzer";
import { TeamFormationError } from "./errors";
import type {
    AgentDefinition,
    LLMProvider,
    Logger,
    OrchestrationConfig,
    ProjectContext,
    RequestAnalysis,
    TaskDefinition,
    Team,
} from "./types";

export interface TeamOrchestrator {
    analyzeAndFormTeam(
        event: NDKEvent,
        availableAgents: Map<string, AgentDefinition>,
        projectContext: ProjectContext
    ): Promise<Team>;
}

interface LLMTeamResponse {
    team: {
        lead: string;
        members: string[];
        reasoning: string;
    };
    taskDefinition?: TaskDefinition;
}

export class TeamOrchestratorImpl implements TeamOrchestrator {
    constructor(
        private readonly analyzer: TeamFormationAnalyzer,
        private readonly llmProvider: LLMProvider,
        private readonly logger: Logger,
        private readonly config: OrchestrationConfig
    ) {
        if (!analyzer) throw new Error("TeamFormationAnalyzer is required");
        if (!llmProvider) throw new Error("LLMProvider is required");
        if (!logger) throw new Error("Logger is required");
        if (!config) throw new Error("OrchestrationConfig is required");
    }

    async analyzeAndFormTeam(
        event: NDKEvent,
        availableAgents: Map<string, AgentDefinition>,
        projectContext: ProjectContext
    ): Promise<Team> {
        try {
            // Step 1: Analyze the request
            const analysis = await this.analyzer.analyzeRequest(event, projectContext);

            // Step 2: Form the team using LLM
            const teamResponse = await this.formTeam(event, analysis, availableAgents);

            // Step 3: Validate team has members
            if (!teamResponse.team.members || teamResponse.team.members.length === 0) {
                throw new TeamFormationError("No suitable agents found for request");
            }

            // Step 4: Create team object
            const team: Team = {
                id: this.generateTeamId(),
                conversationId: event.id,
                lead: teamResponse.team.lead,
                members: teamResponse.team.members,
                strategy: analysis.suggestedStrategy,
                taskDefinition: teamResponse.taskDefinition,
                formation: {
                    timestamp: Date.now(),
                    reasoning: teamResponse.team.reasoning,
                    requestAnalysis: analysis,
                },
            };

            this.logger.info("Team formed", {
                teamSize: team.members.length,
                lead: team.lead,
                strategy: team.strategy,
            });

            return team;
        } catch (error) {
            this.logger.error("Team formation failed", {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    private async formTeam(
        event: NDKEvent,
        analysis: RequestAnalysis,
        availableAgents: Map<string, AgentDefinition>
    ): Promise<LLMTeamResponse> {
        const prompt = this.buildTeamFormationPrompt(event, analysis, availableAgents);
        const response = await this.llmProvider.complete(prompt);

        try {
            return JSON.parse(response.content) as LLMTeamResponse;
        } catch (error) {
            throw new Error(
                `Failed to parse LLM response: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private buildTeamFormationPrompt(
        event: NDKEvent,
        analysis: RequestAnalysis,
        availableAgents: Map<string, AgentDefinition>
    ): string {
        const agentList = Array.from(availableAgents.values())
            .map(
                (agent) =>
                    `- **${agent.name}**: ${agent.description}\n  Role: ${agent.role}\n  Capabilities: ${agent.instructions}`
            )
            .join("\n");

        return `You are forming a team to handle this request.

## Request Analysis
- Type: ${analysis.requestType}
- Required Capabilities: ${analysis.requiredCapabilities.join(", ")}
- Complexity: ${analysis.estimatedComplexity}/10
- Suggested Strategy: ${analysis.suggestedStrategy}
- Reasoning: ${analysis.reasoning}

## User Request
"${event.content}"

## Available Agents
${agentList}

## Task
Select the best team composition from available agents. Consider:
1. Which agents have the required capabilities
2. Who should lead based on the primary focus
3. Keep team size reasonable (max ${this.config.orchestrator.maxTeamSize} members)
4. Define clear success criteria for the task

Return JSON in this format:
{
  "team": {
    "lead": "agent-name",
    "members": ["agent-name1", "agent-name2"],
    "reasoning": "Why this team composition"
  },
  "taskDefinition": {
    "description": "Clear description of what needs to be done",
    "successCriteria": ["Criterion 1", "Criterion 2"],
    "requiresGreenLight": true/false,
    "estimatedComplexity": ${analysis.estimatedComplexity}
  }
}`;
    }

    private generateTeamId(): string {
        return `team-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
