import type { ToolManager } from "@/utils/agents/tools/ToolManager";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import type {
    AgentConfig,
    ConversationStore,
    EventContext,
    Team as ITeam,
    LLMProvider,
    NostrPublisher,
    ProjectContext,
    LLMConfig,
} from "../core/types";
import { Agent } from "../domain/Agent";
import { Team } from "../domain/Team";
import { TeamLead } from "../domain/TeamLead";
import type { TeamOrchestrator } from "./TeamOrchestrator";
import { createLLMProvider } from "../infrastructure/LLMProviderAdapter";

export class EventRouter {
    private teamLeads = new Map<string, TeamLead>();
    private agentConfigs: Map<string, AgentConfig>;
    private llmProvider!: LLMProvider;
    private orchestratorLLMProvider?: LLMProvider;
    private toolManager?: ToolManager;
    private projectEvent?: NDKEvent;
    private llmConfig?: LLMConfig;

    constructor(
        private orchestrator: TeamOrchestrator,
        private store: ConversationStore,
        private publisher: NostrPublisher,
        private ndk: NDK,
        private projectContext: ProjectContext,
        projectEvent?: NDKEvent
    ) {
        this.agentConfigs = new Map();
        this.projectEvent = projectEvent;
    }

    setAgentConfigs(configs: Map<string, AgentConfig>): void {
        this.agentConfigs = configs;
    }

    setLLMProvider(provider: LLMProvider): void {
        this.llmProvider = provider;
    }

    setLLMConfig(config: LLMConfig): void {
        this.llmConfig = config;
    }

    setToolManager(manager: ToolManager): void {
        this.toolManager = manager;
    }

    setPublisher(publisher: NostrPublisher): void {
        this.publisher = publisher;
    }

    getAgent(name: string): Agent | undefined {
        // For debug purposes, create a standalone agent
        const agentConfig = this.agentConfigs.get(name);
        if (!agentConfig) {
            return undefined;
        }

        const toolRegistry = this.toolManager?.createAgentRegistry(name);

        // Enable agent-specific tools
        if (this.toolManager) {
            // Enable remember_lesson if agent has event ID
            if (agentConfig.eventId && this.ndk) {
                this.toolManager.enableRememberLessonTool(name, agentConfig.eventId, this.ndk);
            }

            // Enable find_agent for orchestrators
            if (agentConfig.hasOrchestrationCapability) {
                this.toolManager.enableFindAgentTool(name, true);
            }
        }

        // Create a tool-enabled LLM provider for this agent
        const agentLLMProvider = toolRegistry && (agentConfig.llmConfig || this.llmConfig)
            ? createLLMProvider(agentConfig.llmConfig || this.llmConfig!, this.publisher, toolRegistry)
            : this.llmProvider;

        const agent = new Agent(
            agentConfig,
            agentLLMProvider,
            this.store,
            this.publisher,
            this.ndk,
            toolRegistry
        );
        return agent;
    }

    async handleEvent(event: NDKEvent): Promise<void> {
        logger.info(`EventRouter handling event ${event.id}`);

        // Extract conversation ID
        const conversationId = this.extractConversationId(event);

        // Create event context
        const context: EventContext = {
            conversationId,
            projectId: this.projectContext.projectId,
            originalEvent: event,
            projectEvent: this.projectEvent,
        };

        // Check if we have an existing team for this conversation
        const existingTeam = await this.store.getTeam(conversationId);

        if (existingTeam) {
            logger.info(
                `Found existing team ${existingTeam.id} for conversation ${conversationId}`
            );

            // Get or recreate team lead
            let teamLead = this.teamLeads.get(conversationId);
            if (!teamLead) {
                teamLead = await this.recreateTeamLead(existingTeam);
                this.teamLeads.set(conversationId, teamLead);
            }

            // Route to team lead
            await teamLead.handleEvent(event, context);
        } else {
            logger.info(`No existing team for conversation ${conversationId}, forming new team`);

            // Form new team
            const teamFormation = await this.orchestrator.formTeam({
                event,
                availableAgents: this.agentConfigs,
                projectContext: this.projectContext,
            });

            // Create team and save it
            const teamDomain = Team.create(
                conversationId,
                teamFormation.team.lead,
                teamFormation.team.members,
                teamFormation.conversationPlan
            );
            // Store as the interface type
            const teamData: ITeam = {
                id: teamDomain.id,
                conversationId: teamDomain.conversationId,
                lead: teamDomain.lead,
                members: teamDomain.members,
                plan: teamDomain.plan,
                createdAt: teamDomain.createdAt,
            };
            await this.store.saveTeam(conversationId, teamData);

            // Create team lead and agents
            const teamLead = await this.createTeamLead(teamDomain);
            this.teamLeads.set(conversationId, teamLead);

            // Start handling the event
            await teamLead.handleEvent(event, context);
        }
    }

    private extractConversationId(event: NDKEvent): string {
        const eTags = event.tags.filter((tag) => tag[0] === "E");
        if (eTags.length > 0) {
            // Use the root event as conversation ID
            const firstTag = eTags[0];
            if (firstTag?.[1]) {
                return firstTag[1];
            }
        }

        // For new conversations, use the event ID itself
        return event.id;
    }

    private async createTeamLead(team: Team): Promise<TeamLead> {
        // Get team lead config
        const leadConfig = this.agentConfigs.get(team.lead);
        if (!leadConfig) {
            throw new Error(`Team lead agent '${team.lead}' not found in configurations`);
        }

        // Get tool registry for team lead
        const leadToolRegistry = this.toolManager?.createAgentRegistry(leadConfig.name);

        // Enable agent-specific tools
        if (this.toolManager) {
            // Enable remember_lesson if agent has event ID
            if (leadConfig.eventId && this.ndk) {
                this.toolManager.enableRememberLessonTool(
                    leadConfig.name,
                    leadConfig.eventId,
                    this.ndk
                );
            }

            // Enable find_agent for orchestrators
            if (leadConfig.hasOrchestrationCapability) {
                this.toolManager.enableFindAgentTool(leadConfig.name, true);
            }
        }

        // Create tool-enabled LLM provider for team lead
        const leadLLMProvider = leadToolRegistry && (leadConfig.llmConfig || this.llmConfig)
            ? createLLMProvider(leadConfig.llmConfig || this.llmConfig!, this.publisher, leadToolRegistry)
            : this.llmProvider;

        // Create team lead
        const teamLead = new TeamLead(
            leadConfig,
            leadLLMProvider,
            this.store,
            this.publisher,
            this.ndk,
            team,
            leadToolRegistry
        );
        await teamLead.initialize();

        // Create all team member agents
        const agents = new Map<string, Agent>();
        for (const memberName of team.members) {
            if (memberName === team.lead) {
                agents.set(memberName, teamLead);
                continue;
            }

            const memberConfig = this.agentConfigs.get(memberName);
            if (!memberConfig) {
                logger.warn(`Team member agent '${memberName}' not found in configurations`);
                continue;
            }

            // Get tool registry for member
            const memberToolRegistry = this.toolManager?.createAgentRegistry(memberConfig.name);

            // Enable agent-specific tools
            if (this.toolManager) {
                // Enable remember_lesson if agent has event ID
                if (memberConfig.eventId && this.ndk) {
                    this.toolManager.enableRememberLessonTool(
                        memberConfig.name,
                        memberConfig.eventId,
                        this.ndk
                    );
                }

                // Enable find_agent for orchestrators
                if (memberConfig.hasOrchestrationCapability) {
                    this.toolManager.enableFindAgentTool(memberConfig.name, true);
                }
            }

            // Create tool-enabled LLM provider for member
            const memberLLMProvider = memberToolRegistry && (memberConfig.llmConfig || this.llmConfig)
                ? createLLMProvider(memberConfig.llmConfig || this.llmConfig!, this.publisher, memberToolRegistry)
                : this.llmProvider;

            const agent = new Agent(
                memberConfig,
                memberLLMProvider,
                this.store,
                this.publisher,
                this.ndk,
                memberToolRegistry
            );
            await agent.initialize();
            agents.set(memberName, agent);
        }

        // Set team agents on the team lead
        teamLead.setTeamAgents(agents);

        return teamLead;
    }

    private async recreateTeamLead(team: ITeam): Promise<TeamLead> {
        logger.info(`Recreating team lead for existing team ${team.id}`);
        // Convert interface to domain class
        const teamDomain = new Team(
            team.id,
            team.conversationId,
            team.lead,
            team.members,
            team.plan,
            team.createdAt
        );
        return this.createTeamLead(teamDomain);
    }
}
