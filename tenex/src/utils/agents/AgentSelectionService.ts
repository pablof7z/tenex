import type { ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import type { OrchestrationCoordinator } from "@/core/orchestration/integration/OrchestrationCoordinator";
import type { Team } from "@/core/orchestration/types";
import type { Agent } from "@/utils/agents/Agent";
import type { ConversationStorage } from "@/utils/agents/ConversationStorage";
import type { SystemPromptContextFactory } from "@/utils/agents/prompts/SystemPromptContextFactory";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";

export interface AgentSelectionResult {
    agents: Agent[];
    team?: Team;
    reasoning?: string;
}

export interface AgentSelectionDependencies {
    isEventFromAnyAgent: (eventPubkey: string) => Promise<boolean>;
    getAgentByPubkey: (pubkey: string) => Promise<Agent | undefined>;
    getAllAvailableAgents?: () => Promise<
        Map<string, { description: string; role: string; capabilities: string }>
    >;
}

/**
 * Service responsible for determining which agents should respond to events
 * Handles p-tag prioritization, orchestration integration, and anti-chatter logic
 */
export class AgentSelectionService {
    private dependencies?: AgentSelectionDependencies;

    constructor(
        private agents: Map<string, Agent>,
        private projectInfo?: ProjectRuntimeInfo,
        private orchestrationCoordinator?: OrchestrationCoordinator,
        private contextFactory?: SystemPromptContextFactory,
        private conversationStorage?: ConversationStorage
    ) {}

    /**
     * Update the agents map
     */
    updateAgents(agents: Map<string, Agent>): void {
        this.agents = agents;
    }

    /**
     * Update dependencies for external function calls
     */
    updateDependencies(dependencies: AgentSelectionDependencies): void {
        this.dependencies = dependencies;
    }

    /**
     * Determine which agents should respond to an event
     */
    async determineRespondingAgents(
        event: NDKEvent,
        conversationId: string,
        mentionedPubkeys: string[] = [],
        isTaskEvent = false
    ): Promise<AgentSelectionResult> {
        try {
            // 1. Check for p-tagged agents (highest priority)
            const pTaggedAgents = await this.findPTaggedAgents(mentionedPubkeys);
            if (pTaggedAgents.length > 0) {
                logger.info(`🎯 Found ${pTaggedAgents.length} p-tagged agents`);
                return {
                    agents: pTaggedAgents,
                    reasoning: "P-tagged agents selected",
                };
            }

            // 2. Check if event is from an agent (anti-chatter logic)
            if (this.dependencies?.isEventFromAnyAgent) {
                const isFromAgent = await this.dependencies.isEventFromAnyAgent(event.pubkey);
                if (isFromAgent && mentionedPubkeys.length === 0) {
                    logger.info(
                        "🚫 Applying anti-chatter logic: no response to agent message without p-tags"
                    );
                    return {
                        agents: [],
                        reasoning: "Anti-chatter: agent message without p-tags",
                    };
                }
            }

            // 3. Check for existing team in conversation
            const existingTeam = await this.findExistingTeam(conversationId);
            if (existingTeam) {
                logger.info(`🔄 Found existing team: ${existingTeam.id}`);
                const teamAgents = await this.getTeamAgents(existingTeam);
                return {
                    agents: teamAgents,
                    team: existingTeam,
                    reasoning: "Existing team continuation",
                };
            }

            // 4. Use orchestration to form new team
            if (this.orchestrationCoordinator) {
                logger.info("🤝 Using orchestration to determine responding agents");
                const orchestrationResult = await this.orchestrationCoordinator.handleUserEvent(
                    event,
                    conversationId,
                    this.projectInfo
                );

                if (orchestrationResult.success && orchestrationResult.team) {
                    const teamAgents = await this.getTeamAgents(orchestrationResult.team);
                    return {
                        agents: teamAgents,
                        team: orchestrationResult.team,
                        reasoning: "New team formed via orchestration",
                    };
                }
            }

            // 5. Fallback to default agent
            logger.info("🔧 Falling back to default agent");
            const defaultAgent = this.agents.get("code");
            if (defaultAgent) {
                return {
                    agents: [defaultAgent],
                    reasoning: "Fallback to default agent",
                };
            }

            // 6. No agents available
            logger.warn("⚠️ No agents available to respond");
            return {
                agents: [],
                reasoning: "No agents available",
            };
        } catch (error) {
            logger.error(`Failed to determine responding agents: ${error}`);
            return {
                agents: [],
                reasoning: `Error: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }

    /**
     * Find agents that are mentioned via p-tags
     */
    private async findPTaggedAgents(mentionedPubkeys: string[]): Promise<Agent[]> {
        const pTaggedAgents: Agent[] = [];

        for (const pubkey of mentionedPubkeys) {
            if (this.dependencies?.getAgentByPubkey) {
                const agent = await this.dependencies.getAgentByPubkey(pubkey);
                if (agent) {
                    pTaggedAgents.push(agent);
                }
            }
        }

        return pTaggedAgents;
    }

    /**
     * Find existing team in conversation
     */
    private async findExistingTeam(conversationId: string): Promise<Team | undefined> {
        // Check if any agent has an existing conversation with team metadata
        for (const [_name, agent] of this.agents) {
            const conversation = agent.getConversation?.(conversationId);
            if (conversation && conversation.isParticipant?.(conversationId)) {
                const team = conversation.getMetadata?.("team") as Team | undefined;
                if (team) {
                    return team;
                }
            }
        }
        return undefined;
    }

    /**
     * Get agents from team members
     */
    private async getTeamAgents(team: Team): Promise<Agent[]> {
        const teamAgents: Agent[] = [];

        for (const memberName of team.members) {
            const agent = this.agents.get(memberName);
            if (agent) {
                teamAgents.push(agent);
            } else {
                logger.warn(`Team member ${memberName} not found in available agents`);
            }
        }

        return teamAgents;
    }
}
