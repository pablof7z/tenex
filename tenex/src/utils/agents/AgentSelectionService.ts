import type { ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import type { OrchestrationCoordinator } from "@/core/orchestration/integration/OrchestrationCoordinator";
import type { AgentDefinition, EventContext, Team } from "@/core/orchestration/types";
import type { Agent } from "@/utils/agents/Agent";
import type { ConversationStorage } from "@/utils/agents/ConversationStorage";
import type { SystemPromptContextFactory } from "@/utils/agents/prompts/SystemPromptContextFactory";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";

/**
 * Service for determining which agents should respond to events
 * Extracted from AgentCommunicationHandler to reduce complexity
 */
export class AgentSelectionService {
    constructor(
        private agents: Map<string, Agent>,
        private projectInfo?: ProjectRuntimeInfo,
        private orchestrationCoordinator?: OrchestrationCoordinator,
        private contextFactory?: SystemPromptContextFactory,
        private conversationStorage?: ConversationStorage,
        private dependencies?: {
            isEventFromAnyAgent: (eventPubkey: string) => Promise<boolean>;
            getAgentByPubkey: (pubkey: string) => Promise<Agent | undefined>;
            getAllAvailableAgents?: () => Promise<
                Map<string, { description: string; role: string; capabilities: string }>
            >;
        }
    ) {}

    /**
     * Determine which agents should respond to an event
     */
    async determineRespondingAgents(
        event: NDKEvent,
        conversationId: string,
        mentionedPubkeys: string[],
        isTaskEvent: boolean
    ): Promise<{ agents: Agent[]; team?: Team }> {
        this.logAnalysisStart(event, conversationId, mentionedPubkeys, isTaskEvent);

        // Check if the event is from another agent
        const isFromAgent = await this.checkIfEventFromAgent(event);

        // Apply anti-chatter logic
        if (await this.shouldApplyAntiChatter(isFromAgent, mentionedPubkeys, isTaskEvent)) {
            return { agents: [] };
        }

        // Get existing team and participating agents
        const { existingTeam } = await this.getExistingTeamInfo(conversationId);

        // Priority 1: P-tagged agents
        const pTaggedAgents = await this.getPTaggedAgents(mentionedPubkeys, event);
        if (pTaggedAgents.length > 0) {
            return { agents: pTaggedAgents };
        }

        // Priority 2: Use existing team if available
        if (existingTeam && !isFromAgent) {
            const teamAgents = await this.getTeamAgents(existingTeam, event);
            return { agents: teamAgents, team: existingTeam };
        }

        // Priority 3: Use orchestration for new conversations
        logger.info("🔄 Checking orchestration path:");
        logger.info(`   Is from agent: ${isFromAgent}`);
        logger.info(`   Has orchestration coordinator: ${!!this.orchestrationCoordinator}`);

        if (!isFromAgent && this.orchestrationCoordinator) {
            return await this.useOrchestrationForTeamFormation(event, conversationId);
        }

        this.logOrchestrationSkipped(isFromAgent);
        return this.logFinalResult([]);
    }

    /**
     * Log the start of agent analysis
     */
    private logAnalysisStart(
        event: NDKEvent,
        conversationId: string,
        mentionedPubkeys: string[],
        isTaskEvent: boolean
    ): void {
        logger.info("🔍 DETERMINE RESPONDING AGENTS - Starting analysis");
        logger.info(`   Event ID: ${event.id}`);
        logger.info(`   Conversation ID: ${conversationId}`);
        logger.info(`   Mentioned pubkeys: ${JSON.stringify(mentionedPubkeys)}`);
        logger.info(`   Event author: ${event.pubkey}`);
        logger.info(`   Is task event: ${isTaskEvent}`);
    }

    /**
     * Check if the event is from an agent
     */
    private async checkIfEventFromAgent(event: NDKEvent): Promise<boolean> {
        const isFromAgent = await this.dependencies?.isEventFromAnyAgent(event.author.pubkey);

        return isFromAgent ?? false;
    }

    /**
     * Apply anti-chatter logic
     */
    private async shouldApplyAntiChatter(
        isFromAgent: boolean,
        mentionedPubkeys: string[],
        isTaskEvent: boolean
    ): Promise<boolean> {
        if (isFromAgent && mentionedPubkeys.length === 0) {
            const eventType = isTaskEvent ? "Task" : "Event";
            logger.warn(
                `🚫 ANTI-CHATTER TRIGGERED: ${eventType} event is from an agent with no agents selected. No agents will respond to avoid unnecessary chatter.`
            );
            return true;
        }
        return false;
    }

    /**
     * Get existing team information from conversations
     */
    private async getExistingTeamInfo(conversationId: string): Promise<{
        participatingAgents: Agent[];
        existingTeam?: Team;
    }> {
        const participatingAgents: Agent[] = [];
        let existingTeam: Team | undefined;

        for (const [_name, agent] of this.agents) {
            const conversation = agent.getConversation(conversationId);
            if (conversation) {
                // Check for existing team in metadata
                const teamMetadata = conversation.getMetadata("team") as Team | undefined;
                if (teamMetadata && !existingTeam) {
                    existingTeam = teamMetadata;
                    logger.debug(` Found existing team: ${JSON.stringify(existingTeam)}`);
                }

                if (conversation.isParticipant(agent.getPubkey())) {
                    participatingAgents.push(agent);
                }
            }
        }

        logger.debug(` participatingAgents count: ${participatingAgents.length}`);
        return { participatingAgents, existingTeam };
    }

    /**
     * Get agents that are p-tagged (mentioned)
     */
    private async getPTaggedAgents(mentionedPubkeys: string[], event: NDKEvent): Promise<Agent[]> {
        const agentsToRespond: Agent[] = [];

        if (mentionedPubkeys.length > 0) {
            logger.debug(` Processing ${mentionedPubkeys.length} mentioned pubkeys`);
            for (const pubkey of mentionedPubkeys) {
                logger.debug(` Looking up agent for pubkey: ${pubkey}`);
                const mentionedAgent = await this.dependencies?.getAgentByPubkey(pubkey);
                logger.debug(` Found agent: ${mentionedAgent ? mentionedAgent.getName() : "null"}`);
                if (mentionedAgent && mentionedAgent.getPubkey() !== event.author.pubkey) {
                    agentsToRespond.push(mentionedAgent);
                    logger.info(
                        `Agent '${mentionedAgent.getName()}' was p-tagged and will join the conversation`
                    );
                } else if (mentionedAgent && mentionedAgent.getPubkey() === event.author.pubkey) {
                    logger.debug(` Skipping self-mention for agent: ${mentionedAgent.getName()}`);
                }
            }
        }

        return agentsToRespond;
    }

    /**
     * Get agents from an existing team
     */
    private async getTeamAgents(existingTeam: Team, event: NDKEvent): Promise<Agent[]> {
        const agentsToRespond: Agent[] = [];
        logger.info(`Using existing team for conversation: ${existingTeam.id}`);

        for (const memberName of existingTeam.members) {
            const agent = this.agents.get(memberName);
            if (agent && agent.getPubkey() !== event.author.pubkey) {
                agentsToRespond.push(agent);
                logger.debug(` Added team member: ${memberName}`);
            }
        }

        return agentsToRespond;
    }

    /**
     * Use orchestration to form a new team
     */
    private async useOrchestrationForTeamFormation(
        event: NDKEvent,
        conversationId: string
    ): Promise<{ agents: Agent[]; team?: Team }> {
        try {
            logger.info("🎭 ORCHESTRATION PATH - Starting team formation");
            logger.info(
                `   Orchestration coordinator available: ${!!this.orchestrationCoordinator}`
            );

            // Build agent definitions for orchestration
            const availableAgentDefs = await this.buildAgentDefinitions();

            const eventContext: EventContext = {
                conversationId,
                hasPTags: false,
                availableAgents: availableAgentDefs,
                projectContext: {
                    projectInfo: this.projectInfo,
                    repository: this.projectInfo?.repository,
                    title: this.projectInfo?.title,
                },
                originalEvent: event,
            };

            logger.info("🎯 Calling orchestration coordinator...");
            logger.info(`   Available agents: ${Array.from(availableAgentDefs.keys()).join(", ")}`);
            logger.info(`   Project title: ${this.projectInfo?.title || "unknown"}`);

            const orchestrationResult = await this.orchestrationCoordinator!.handleUserEvent(
                event,
                eventContext
            );

            logger.info("🎭 Orchestration result received:");
            logger.info(`   Team formed: ${orchestrationResult.teamFormed}`);
            logger.info(`   Team object exists: ${!!orchestrationResult.team}`);

            if (orchestrationResult.team) {
                return await this.handleOrchestrationSuccess(
                    orchestrationResult.team,
                    conversationId
                );
            }
            logger.warn("⚠️  Orchestration completed but no team was formed");
            logger.warn(`   Team formed flag: ${orchestrationResult.teamFormed}`);
            logger.warn(`   Team object: ${JSON.stringify(orchestrationResult.team)}`);
            logger.warn("   This means no agents were selected by orchestration");
            return { agents: [] };
        } catch (error) {
            logger.error(`💥 ORCHESTRATION FAILED: ${error}`);
            logger.error(
                `   Error type: ${error instanceof Error ? error.constructor.name : typeof error}`
            );
            if (error instanceof Error) {
                logger.error(`   Error stack: ${error.stack}`);
            }
            // Handle orchestration failures gracefully by returning empty agent list
            // This prevents the entire event processing from failing
            return { agents: [] };
        }
    }

    /**
     * Build agent definitions for orchestration
     */
    private async buildAgentDefinitions(): Promise<Map<string, AgentDefinition>> {
        const availableAgentDefs = new Map<string, AgentDefinition>();

        if (this.dependencies?.getAllAvailableAgents) {
            logger.info("📋 Getting agent info from getAllAvailableAgentsFn...");
            const allAgentInfo = await this.dependencies.getAllAvailableAgents();
            logger.info(`   Found ${allAgentInfo.size} agents from function`);
            for (const [name, info] of allAgentInfo) {
                availableAgentDefs.set(name, {
                    name,
                    description: info.description || "",
                    role: info.role || "",
                    instructions: "",
                });
                logger.info(
                    `   Agent ${name}: ${info.description || "no description"} (${info.role || "no role"})`
                );
            }
        } else {
            // Fallback: use basic info from agents map
            logger.info("📋 Using fallback agent info from agents map...");
            for (const [name, _agent] of this.agents) {
                availableAgentDefs.set(name, {
                    name,
                    description: `Agent ${name}`,
                    role: "AI Assistant",
                    instructions: "",
                });
                logger.info(`   Agent ${name}: fallback description`);
            }
        }

        return availableAgentDefs;
    }

    /**
     * Handle successful orchestration result
     */
    private async handleOrchestrationSuccess(
        team: Team,
        conversationId: string
    ): Promise<{ agents: Agent[]; team: Team }> {
        const agentsToRespond: Agent[] = [];
        logger.info(
            `✅ Orchestration formed team '${team.id}' with members: ${team.members.join(", ")}`
        );

        // Get agents for the team members and save team metadata
        for (const memberName of team.members) {
            const agent = this.agents.get(memberName);
            if (agent) {
                agentsToRespond.push(agent);

                // Save team metadata to agent's conversation
                if (this.contextFactory && this.conversationStorage) {
                    const context = await this.contextFactory.createContext(agent, false);
                    const conversation = await agent.getOrCreateConversationWithContext(
                        conversationId,
                        context
                    );

                    if (conversation) {
                        conversation.setMetadata("team", team);
                        await agent.saveConversationToStorage(conversation);
                        logger.debug(` Saved team metadata to ${memberName}'s conversation`);
                    }
                }
            }
        }

        return { agents: agentsToRespond, team };
    }

    /**
     * Log when orchestration is skipped
     */
    private logOrchestrationSkipped(isFromAgent: boolean): void {
        logger.info("🚫 ORCHESTRATION SKIPPED:");
        logger.info(`   Is from agent: ${isFromAgent}`);
        logger.info(`   Has orchestration coordinator: ${!!this.orchestrationCoordinator}`);
        logger.info(
            `   Reason: ${isFromAgent ? "Event from agent" : "No orchestration coordinator"}`
        );
    }

    /**
     * Log final result
     */
    private logFinalResult(agentsToRespond: Agent[]): { agents: Agent[] } {
        logger.info("📊 FINAL RESULT - Agent determination complete:");
        logger.info(`   Final agentsToRespond count: ${agentsToRespond.length}`);
        logger.info(
            `   Final agentsToRespond names: ${agentsToRespond.map((a) => a.getName()).join(", ")}`
        );

        if (agentsToRespond.length === 0) {
            logger.warn("⚠️  NO AGENTS SELECTED TO RESPOND");
            logger.warn(
                "   This means the event will be processed but no responses will be generated"
            );
        }

        return { agents: agentsToRespond };
    }

    /**
     * Update agents map
     */
    updateAgents(agents: Map<string, Agent>): void {
        this.agents = agents;
    }

    /**
     * Update dependencies
     */
    updateDependencies(dependencies: {
        isEventFromAnyAgent: (eventPubkey: string) => Promise<boolean>;
        getAgentByPubkey: (pubkey: string) => Promise<Agent | undefined>;
        getAllAvailableAgents?: () => Promise<
            Map<string, { description: string; role: string; capabilities: string }>
        >;
    }): void {
        this.dependencies = dependencies;
    }
}
