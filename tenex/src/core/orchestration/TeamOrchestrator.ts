import type { TypingIndicatorPublisher } from "@/core/orchestration/OrchestrationFactory";
import type { TeamFormationAnalyzer } from "@/core/orchestration/TeamFormationAnalyzer";
import { TeamFormationError } from "@/core/orchestration/errors";
import type {
    AgentDefinition,
    LLMProvider,
    Logger,
    OrchestrationConfig,
    ProjectContext,
    Team,
} from "@/core/orchestration/types";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { traceFunction } from "@tenex/shared/services";

export interface TeamOrchestrator {
    analyzeAndFormTeam(
        event: NDKEvent,
        availableAgents: Map<string, AgentDefinition>,
        projectContext: ProjectContext
    ): Promise<Team>;
}

export class TeamOrchestratorImpl implements TeamOrchestrator {
    constructor(
        private readonly analyzer: TeamFormationAnalyzer,
        private readonly llmProvider: LLMProvider,
        private readonly logger: Logger,
        private readonly config: OrchestrationConfig,
        private readonly typingIndicatorPublisher?: TypingIndicatorPublisher
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
        return traceFunction(
            "orchestration.team.analyzeAndFormTeam",
            async (span) => {
                try {
                    span?.setAttributes({
                        "orchestration.event_id": event.id || "unknown",
                        "orchestration.event_content_length": event.content?.length || 0,
                        "orchestration.available_agents_count": availableAgents.size,
                        "orchestration.project_title": projectContext?.title || "unknown",
                        "orchestration.llm_provider_available": Boolean(this.llmProvider),
                    });

                    this.logger.info("🎯 TEAM ORCHESTRATOR - Starting team formation");
                    this.logger.info(`   Event ID: ${event.id}`);
                    this.logger.info(`   Event content: "${event.content}"`);
                    this.logger.info(
                        `   Available agents: ${Array.from(availableAgents.keys()).join(", ")}`
                    );
                    this.logger.info(`   Project: ${projectContext?.title || "unknown"}`);

                    // Use the new combined analysis and team formation method
                    this.logger.info("🧠 Performing combined analysis and team formation...");
                    const combinedResponse = await this.analyzer.analyzeAndFormTeam(
                        event,
                        projectContext,
                        availableAgents
                    );

                    span?.setAttributes({
                        "orchestration.analysis.request_type":
                            combinedResponse.analysis.requestType,
                        "orchestration.analysis.complexity":
                            combinedResponse.analysis.estimatedComplexity,
                        "orchestration.analysis.capabilities_count":
                            combinedResponse.analysis.requiredCapabilities.length,
                        "orchestration.analysis.strategy":
                            combinedResponse.analysis.suggestedStrategy,
                        "orchestration.team.lead": combinedResponse.team.lead,
                        "orchestration.team.members_count": combinedResponse.team.members.length,
                        "orchestration.team.has_task_definition": Boolean(
                            combinedResponse.taskDefinition
                        ),
                    });

                    this.logger.info("✅ Combined analysis and team formation complete:");
                    this.logger.info(`   Type: ${combinedResponse.analysis.requestType}`);
                    this.logger.info(
                        `   Complexity: ${combinedResponse.analysis.estimatedComplexity}/10`
                    );
                    this.logger.info(
                        `   Required capabilities: ${combinedResponse.analysis.requiredCapabilities.join(", ")}`
                    );
                    this.logger.info(
                        `   Suggested strategy: ${combinedResponse.analysis.suggestedStrategy}`
                    );
                    this.logger.info(
                        `   Analysis reasoning: ${combinedResponse.analysis.reasoning}`
                    );
                    this.logger.info(`   Lead: ${combinedResponse.team.lead}`);
                    this.logger.info(`   Members: ${combinedResponse.team.members.join(", ")}`);
                    this.logger.info(`   Team reasoning: ${combinedResponse.team.reasoning}`);

                    // Validate team formation response
                    if (!combinedResponse.team) {
                        span?.setAttributes({
                            "orchestration.team.formation_success": false,
                            "orchestration.team.failure_reason": "invalid_team_response",
                        });
                        this.logger.error(
                            "❌ Team formation failed: Invalid team response - missing team object"
                        );
                        throw new TeamFormationError("Invalid team response from LLM");
                    }

                    if (!combinedResponse.team.lead) {
                        span?.setAttributes({
                            "orchestration.team.formation_success": false,
                            "orchestration.team.failure_reason": "no_lead_selected",
                        });
                        this.logger.error("❌ Team formation failed: No lead agent selected");
                        this.logger.error(
                            `   Raw team response: ${JSON.stringify(combinedResponse.team, null, 2)}`
                        );
                        throw new TeamFormationError("No lead agent selected for team");
                    }

                    if (
                        !combinedResponse.team.members ||
                        combinedResponse.team.members.length === 0
                    ) {
                        span?.setAttributes({
                            "orchestration.team.formation_success": false,
                            "orchestration.team.failure_reason": "no_agents_selected",
                        });
                        this.logger.error("❌ Team formation failed: No team members selected");
                        this.logger.error(`   Lead agent: ${combinedResponse.team.lead}`);
                        this.logger.error(
                            `   Members array: ${JSON.stringify(combinedResponse.team.members)}`
                        );
                        this.logger.error(
                            `   Raw team response: ${JSON.stringify(combinedResponse.team, null, 2)}`
                        );
                        throw new TeamFormationError("No team members selected for request");
                    }

                    // Create team object
                    this.logger.info("🔧 Creating team object...");
                    const team: Team = {
                        id: this.generateTeamId(),
                        conversationId: event.id,
                        lead: combinedResponse.team.lead,
                        members: combinedResponse.team.members,
                        strategy: combinedResponse.analysis.suggestedStrategy,
                        taskDefinition: combinedResponse.taskDefinition,
                        formation: {
                            timestamp: Date.now(),
                            reasoning: combinedResponse.team.reasoning,
                            requestAnalysis: combinedResponse.analysis,
                        },
                    };

                    span?.setAttributes({
                        "orchestration.team.formation_success": true,
                        "orchestration.team.id": team.id,
                        "orchestration.team.final_size": team.members.length,
                        "orchestration.team.strategy": team.strategy,
                    });

                    this.logger.info("🎉 TEAM FORMATION SUCCESS:");
                    this.logger.info(`   Team ID: ${team.id}`);
                    this.logger.info(`   Team size: ${team.members.length}`);
                    this.logger.info(`   Lead: ${team.lead}`);
                    this.logger.info(`   Strategy: ${team.strategy}`);
                    this.logger.info(`   Members: ${team.members.join(", ")}`);

                    return team;
                } catch (error) {
                    span?.setAttributes({
                        "orchestration.team.formation_success": false,
                        "orchestration.team.error_type":
                            error instanceof Error ? error.constructor.name : typeof error,
                        "orchestration.team.error_message":
                            error instanceof Error ? error.message : String(error),
                    });

                    this.logger.error("💥 TEAM FORMATION FAILED:");
                    this.logger.error(
                        `   Error type: ${error instanceof Error ? error.constructor.name : typeof error}`
                    );
                    this.logger.error(
                        `   Error message: ${error instanceof Error ? error.message : String(error)}`
                    );
                    if (error instanceof Error && error.stack) {
                        this.logger.error(`   Error stack: ${error.stack}`);
                    }
                    this.logger.error(
                        `   Available agents: ${Array.from(availableAgents.keys()).join(", ")}`
                    );
                    throw error;
                }
            },
            {
                "operation.type": "team_formation",
                "service.name": "tenex-orchestration",
            }
        );
    }

    private generateTeamId(): string {
        return `team-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
