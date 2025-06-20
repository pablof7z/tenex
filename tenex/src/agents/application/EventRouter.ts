import type { ToolManager } from "@/utils/agents/tools/ToolManager";
import type { NDKEvent, NDKProject } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";

const routerLogger = logger.forModule("orchestration");
import type {
  AgentConfig,
  AgentSummary,
  ConversationStore,
  EventContext,
  Team as ITeam,
  LLMConfig,
  LLMProvider,
  NostrPublisher,
  SpecSummary,
} from "../core/types";
import { Agent } from "../domain/Agent";
import { Team } from "../domain/Team";
import { TeamLead } from "../domain/TeamLead";
import { createLLMProvider } from "../infrastructure/LLMProviderAdapter";
import type { TeamOrchestrator } from "./TeamOrchestrator";

export class EventRouter {
  private teamLeads = new Map<string, TeamLead>();
  private agentConfigs: Map<string, AgentConfig>;
  private llmProvider!: LLMProvider;
  private toolManager?: ToolManager;
  private llmConfig?: LLMConfig;

  constructor(
    private orchestrator: TeamOrchestrator,
    private store: ConversationStore,
    private publisher: NostrPublisher,
    private ndk: NDK,
    private projectEvent: NDKProject
  ) {
    this.agentConfigs = new Map();
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

      // All agents can use find_agent tool for collaboration
      this.toolManager.enableFindAgentTool(name);
    }

    // Create a tool-enabled LLM provider for this agent
    const effectiveLLMConfig = agentConfig.llmConfig || this.llmConfig;
    const agentLLMProvider = effectiveLLMConfig
      ? createLLMProvider(effectiveLLMConfig, this.publisher)
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

  async handleEvent(
    event: NDKEvent,
    availableSpecs?: SpecSummary[],
    availableAgents?: AgentSummary[]
  ): Promise<void> {
    routerLogger.info(`EventRouter handling event ${event.id}`, "verbose");

    // Extract root event ID
    const rootEventId = this.extractRootEventId(event);

    // Create event context
    const context: EventContext = {
      rootEventId,
      originalEvent: event,
      projectEvent: this.projectEvent,
      availableSpecs,
      availableAgents,
    };

    // Check if we have an existing team for this conversation
    const existingTeam = await this.store.getTeam(rootEventId);

    if (existingTeam) {
      routerLogger.info(
        `Found existing team ${existingTeam.id} for conversation ${rootEventId}`,
        "verbose"
      );

      // Get or recreate team lead
      let teamLead = this.teamLeads.get(rootEventId);
      if (!teamLead) {
        teamLead = await this.recreateTeamLead(existingTeam);
        this.teamLeads.set(rootEventId, teamLead);
      }

      // Route to team lead
      await teamLead.handleEvent(event, context);
    } else {
      // Extract p-tags (mentioned agent pubkeys) from the event
      const mentionedAgentPubkeys = event.tags
        .filter(tag => tag[0] === "p" && tag[1])
        .map(tag => tag[1]);

      if (mentionedAgentPubkeys.length > 0) {
        // Direct routing to p-tagged agents - no team formation needed
        routerLogger.info(`Direct routing to p-tagged agents for conversation ${rootEventId}`);
        
        // Find which agents match the p-tagged pubkeys
        const matchedAgents: string[] = [];
        for (const [name, config] of this.agentConfigs.entries()) {
          if (config.pubkey && mentionedAgentPubkeys.includes(config.pubkey)) {
            matchedAgents.push(name);
          }
        }

        if (matchedAgents.length > 0) {
          // Create a simple team with the first matched agent as lead
          const lead = matchedAgents[0]!; // Safe because we checked length > 0
          const teamDomain = Team.create(
            rootEventId,
            lead,
            matchedAgents,
            {
              stages: [{
                participants: matchedAgents,
                purpose: "Direct response to user request",
                expectedOutcome: "Address user's specific request",
                transitionCriteria: "Request is fulfilled",
                primarySpeaker: lead
              }],
              estimatedComplexity: 3
            }
          );

          // Store as the interface type
          const teamData: ITeam = {
            id: teamDomain.id,
            rootEventId: teamDomain.rootEventId,
            lead: teamDomain.lead,
            members: teamDomain.members,
            plan: teamDomain.plan,
            createdAt: teamDomain.createdAt,
          };
          await this.store.saveTeam(rootEventId, teamData);

          // Create team lead and agents
          const teamLead = await this.createTeamLead(teamDomain);
          this.teamLeads.set(rootEventId, teamLead);

          // Start handling the event
          await teamLead.handleEvent(event, context);
          return;
        }
      }

      // No p-tags or no matching agents - fall back to team formation
      routerLogger.info(`No existing team for conversation ${rootEventId}, forming new team`);

      // Form new team
      const teamFormation = await this.orchestrator.formTeam({
        event,
        availableAgents: this.agentConfigs,
        projectEvent: this.projectEvent,
      });

      // Create team and save it
      const teamDomain = Team.create(
        rootEventId,
        teamFormation.team.lead,
        teamFormation.team.members,
        teamFormation.conversationPlan
      );
      // Store as the interface type
      const teamData: ITeam = {
        id: teamDomain.id,
        rootEventId: teamDomain.rootEventId,
        lead: teamDomain.lead,
        members: teamDomain.members,
        plan: teamDomain.plan,
        createdAt: teamDomain.createdAt,
      };
      await this.store.saveTeam(rootEventId, teamData);

      // Create team lead and agents
      const teamLead = await this.createTeamLead(teamDomain);
      this.teamLeads.set(rootEventId, teamLead);

      // Start handling the event
      await teamLead.handleEvent(event, context);
    }
  }

  private extractRootEventId(event: NDKEvent): string {
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
        this.toolManager.enableRememberLessonTool(leadConfig.name, leadConfig.eventId, this.ndk);
      }

      // All agents can use find_agent tool for collaboration
      this.toolManager.enableFindAgentTool(leadConfig.name);
    }

    // Create LLM provider for team lead
    const leadEffectiveLLMConfig = leadConfig.llmConfig || this.llmConfig;
    const leadLLMProvider = leadEffectiveLLMConfig
      ? createLLMProvider(leadEffectiveLLMConfig, this.publisher)
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
        routerLogger.warning(`Team member agent '${memberName}' not found in configurations`);
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

        // All agents can use find_agent tool for collaboration
        this.toolManager.enableFindAgentTool(memberConfig.name);
      }

      // Create LLM provider for member
      const memberEffectiveLLMConfig = memberConfig.llmConfig || this.llmConfig;
      const memberLLMProvider = memberEffectiveLLMConfig
        ? createLLMProvider(memberEffectiveLLMConfig, this.publisher)
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
    routerLogger.info(`Recreating team lead for existing team ${team.id}`, "verbose");
    // Convert interface to domain class
    const teamDomain = new Team(
      team.id,
      team.rootEventId,
      team.lead,
      team.members,
      team.plan,
      team.createdAt
    );
    return this.createTeamLead(teamDomain);
  }
}
