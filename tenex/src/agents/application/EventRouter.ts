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
} from "../core/types";
import { Agent } from "../domain/Agent";
import { Team } from "../domain/Team";
import { TeamLead } from "../domain/TeamLead";
import type { TeamOrchestrator } from "./TeamOrchestrator";

export class EventRouter {
    private teamLeads = new Map<string, TeamLead>();
    private agentConfigs: Map<string, AgentConfig>;
    private llmProvider!: LLMProvider;
    private orchestratorLLMProvider?: LLMProvider;
    private toolManager?: ToolManager;

    constructor(
        private orchestrator: TeamOrchestrator,
        private store: ConversationStore,
        private publisher: NostrPublisher,
        private ndk: NDK,
        private projectContext: ProjectContext
    ) {
        this.agentConfigs = new Map();
    }

    setAgentConfigs(configs: Map<string, AgentConfig>): void {
        this.agentConfigs = configs;
    }

    setLLMProvider(provider: LLMProvider): void {
        this.llmProvider = provider;
    }

    setToolManager(manager: ToolManager): void {
        this.toolManager = manager;
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
            // Enable update_spec for default agent only
            this.toolManager.enableUpdateSpecTool(name);
            
            // Enable remember_lesson if agent has event ID
            if (agentConfig.eventId && this.ndk) {
                this.toolManager.enableRememberLessonTool(name, agentConfig.eventId, this.ndk);
            }
            
            // Enable find_agent for orchestrators
            if (agentConfig.hasOrchestrationCapability) {
                this.toolManager.enableFindAgentTool(name, true);
            }
        }
        
        const agent = new Agent(
            agentConfig,
            this.llmProvider,
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
        // Check for 'e' tags (replies)
        const eTags = event.tags.filter((tag) => tag[0] === "e");
        if (eTags.length > 0) {
            // Use the root event as conversation ID
            const firstTag = eTags[0];
            if (firstTag?.[1]) {
                return firstTag[1];
            }
        }

        // For new conversations, use the event ID itself
        return event.id ?? `conv-${Date.now()}`;
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
            // Enable update_spec for default agent only
            this.toolManager.enableUpdateSpecTool(leadConfig.name);
            
            // Enable remember_lesson if agent has event ID
            if (leadConfig.eventId && this.ndk) {
                this.toolManager.enableRememberLessonTool(leadConfig.name, leadConfig.eventId, this.ndk);
            }
            
            // Enable find_agent for orchestrators
            if (leadConfig.hasOrchestrationCapability) {
                this.toolManager.enableFindAgentTool(leadConfig.name, true);
            }
        }

        // Create team lead
        const teamLead = new TeamLead(
            leadConfig,
            this.llmProvider,
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
                // Enable update_spec for default agent only
                this.toolManager.enableUpdateSpecTool(memberConfig.name);
                
                // Enable remember_lesson if agent has event ID
                if (memberConfig.eventId && this.ndk) {
                    this.toolManager.enableRememberLessonTool(memberConfig.name, memberConfig.eventId, this.ndk);
                }
                
                // Enable find_agent for orchestrators
                if (memberConfig.hasOrchestrationCapability) {
                    this.toolManager.enableFindAgentTool(memberConfig.name, true);
                }
            }

            const agent = new Agent(
                memberConfig,
                this.llmProvider,
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

// Import Team here to avoid circular dependency
import { Team } from "../domain/Team";
