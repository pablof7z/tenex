import path from "node:path";
import { AgentRegistry } from "@/agents";
import type { ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import { getEventKindName } from "@/commands/run/constants";
import { ConversationManager } from "@/conversations";
import { LLMConfigurationAdapter } from "@/llm/LLMConfigurationAdapter";
import { LLMService } from "@/llm";
import { ConversationPublisher } from "@/nostr";
import { getNDK } from "@/nostr/ndkClient";
import { ConversationRouter, RoutingLLM } from "@/routing";
import { initializeProjectContext } from "@/runtime";
import type { Agent, AgentConfig } from "@/types/agent";
import { formatError } from "@/utils/errors";
import { NDKArticle, type NDKEvent } from "@nostr-dev-kit/ndk";
import { ensureDirectory, fileExists, readFile, writeJsonFile } from "@tenex/shared/fs";
import { logInfo } from "@tenex/shared/logger";
import { configurationService } from "@tenex/shared/services";
import { EVENT_KINDS } from "@tenex/types/core";
import chalk from "chalk";

export class EventHandler {
  private agentConfigs: Map<string, AgentConfig>;
  private agentRegistry: AgentRegistry;
  private conversationManager: ConversationManager;
  private llmConfigManager: LLMConfigurationAdapter;
  private llmService!: LLMService;
  private routingLLM!: RoutingLLM;
  private conversationRouter!: ConversationRouter;
  private conversationPublisher!: ConversationPublisher;

  constructor(private projectInfo: ProjectRuntimeInfo) {
    this.agentConfigs = new Map();
    this.agentRegistry = new AgentRegistry(projectInfo.projectPath);
    this.conversationManager = new ConversationManager(projectInfo.projectPath);
    this.llmConfigManager = new LLMConfigurationAdapter(projectInfo.projectPath);
    // Services will be initialized in initialize()
  }

  async initialize(): Promise<void> {
    // Get agents from project loader
    const convertedAgents = new Map<string, Agent>();
    for (const [name, projectAgent] of this.projectInfo.agents) {
      const agent: Agent = {
        name: projectAgent.name,
        pubkey: projectAgent.pubkey,
        signer: projectAgent.signer,
        role: projectAgent.role,
        expertise: projectAgent.expertise,
        instructions: projectAgent.instructions,
        llmConfig: "default",
        tools: [],
        eventId: projectAgent.eventId,
      };
      convertedAgents.set(name, agent);
    }

    // Initialize project context globally
    initializeProjectContext({
      projectEvent: this.projectInfo.projectEvent,
      projectSigner: this.projectInfo.projectSigner,
      agents: convertedAgents,
      projectPath: this.projectInfo.projectPath,
      title: this.projectInfo.title,
      repository: this.projectInfo.repository,
    });

    // Initialize services
    await this.llmConfigManager.loadConfigurations();
    this.llmService = new LLMService(this.llmConfigManager);

    await this.agentRegistry.loadFromProject();
    await this.conversationManager.initialize();

    // Initialize routing system
    let routingConfig = "default";
    try {
      routingConfig = this.llmConfigManager.getDefaultConfig("agentRouting");
    } catch {
      routingConfig = this.llmConfigManager.getDefaultConfig("default");
    }
    this.routingLLM = new RoutingLLM(this.llmService, routingConfig, this.projectInfo.projectPath);
    logInfo(`Initialized RoutingLLM with configuration: ${routingConfig}`);

    // Get the initialized project context
    const projectContext = {
      projectEvent: this.projectInfo.projectEvent,
      projectSigner: this.projectInfo.projectSigner,
      agents: convertedAgents,
      projectPath: this.projectInfo.projectPath,
      title: this.projectInfo.title,
      repository: this.projectInfo.repository,
    };

    this.conversationPublisher = new ConversationPublisher(projectContext, getNDK());
    this.conversationRouter = new ConversationRouter(
      this.conversationManager,
      this.routingLLM,
      this.conversationPublisher,
      this.llmService
    );

    // Load agent configurations
    await this.loadAgentConfigs();

    // Create the new agent system
    if (!this.projectInfo.projectEvent.id) {
      throw new Error("Project event ID is required but was not found");
    }

    logInfo("EventHandler initialized with conversation routing support");
  }

  private async loadAgentConfigs(): Promise<void> {
    // Register agents from ProjectLoader into the AgentRegistry
    for (const [name, agent] of this.projectInfo.agents) {
      const config: AgentConfig = {
        name: agent.name,
        role: agent.role,
        expertise: agent.role, // Use role as expertise for now
        instructions: agent.instructions,
        nsec: agent.signer.nsec,
        eventId: agent.eventId,
        pubkey: agent.pubkey,
        tools: [],
      };

      this.agentConfigs.set(name, config);

      // Ensure agent is in registry
      await this.agentRegistry.ensureAgent(name, config);
    }
  }

  async handleEvent(event: NDKEvent): Promise<void> {
    // Ignore kind 24010 (project status), 24111 (typing indicator), and 24112 (typing stop) events
    if (
      event.kind === EVENT_KINDS.PROJECT_STATUS ||
      event.kind === EVENT_KINDS.TYPING_INDICATOR ||
      event.kind === EVENT_KINDS.TYPING_INDICATOR_STOP
    ) {
      return;
    }

    logInfo(chalk.gray("\n📥 Event received:", event.id));

    const timestamp = new Date().toLocaleTimeString();
    const eventKindName = getEventKindName(event.kind);

    logInfo(chalk.gray(`\n[${timestamp}] `) + chalk.cyan(`${eventKindName} received`));
    logInfo(chalk.gray("From:    ") + chalk.white(event.author.npub));
    logInfo(chalk.gray("Event:   ") + chalk.gray(event.encode()));

    switch (event.kind) {
      case EVENT_KINDS.GENERIC_REPLY:
        await this.handleChatMessage(event);
        break;

      case 11: // New conversation (kind:11)
        await this.handleNewConversation(event);
        break;

      case EVENT_KINDS.TASK:
        await this.handleTask(event);
        break;

      case EVENT_KINDS.PROJECT_STATUS:
        this.handleProjectStatus(event);
        break;

      case EVENT_KINDS.PROJECT:
        await this.handleProjectEvent(event);
        break;

      default:
        this.handleDefaultEvent(event);
    }
  }

  private async handleChatMessage(event: NDKEvent): Promise<void> {
    logInfo(
      chalk.gray("Message: ") +
        chalk.white(event.content.substring(0, 100) + (event.content.length > 100 ? "..." : ""))
    );

    // Extract p-tags to identify mentioned agents
    const pTags = event.tags.filter((tag) => tag[0] === "p");
    const mentionedPubkeys = pTags
      .map((tag) => tag[1])
      .filter((pubkey): pubkey is string => !!pubkey);

    if (mentionedPubkeys.length > 0) {
      logInfo(
        chalk.gray("P-tags:  ") +
          chalk.cyan(`${mentionedPubkeys.length} pubkeys mentioned: ${mentionedPubkeys.join(", ")}`)
      );
    }

    // Check if this message is directed to the system (project or agents)
    // If it has p-tags that don't belong to our system, skip routing
    if (pTags.length > 0) {
      const systemPubkeys = new Set([
        this.projectInfo.projectSigner.pubkey,
        ...Array.from(this.projectInfo.agents.values()).map((a) => a.pubkey),
      ]);

      const isDirectedToSystem = mentionedPubkeys.some((pubkey) => systemPubkeys.has(pubkey));

      if (!isDirectedToSystem) {
        logInfo(
          chalk.gray(
            "Message is not directed to system (p-tags point to external users), skipping routing"
          )
        );
        return;
      }
    }

    // Check if this event has any "e" tags (event references)
    const hasEventTag = event.tags.some((tag) => tag[0] === "E");

    if (!hasEventTag) {
      // This is a new conversation - route through the routing LLM
      try {
        // Get all available agents
        const availableAgents = await this.agentRegistry.getAllAgents();

        // Route the new conversation through the routing LLM
        await this.conversationRouter.routeNewConversation(event, availableAgents);

        logInfo(chalk.green("✅ New conversation routed successfully"));
      } catch (error) {
        logInfo(chalk.red(`❌ Failed to route new conversation: ${formatError(error)}`));
      }
    } else {
      // This is a reply within an existing conversation
      try {
        const availableAgents = await this.agentRegistry.getAllAgents();
        await this.conversationRouter.routeReply(event, availableAgents);
        logInfo(chalk.green("✅ Reply routed successfully"));
      } catch (error) {
        logInfo(chalk.red(`❌ Failed to route reply: ${formatError(error)}`));
      }
    }
  }

  private async handleTask(event: NDKEvent): Promise<void> {
    const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled";
    logInfo(chalk.gray("Task:    ") + chalk.yellow(title));
    logInfo(
      chalk.gray("Content: ") +
        chalk.white(event.content.substring(0, 100) + (event.content.length > 100 ? "..." : ""))
    );

    // Extract p-tags to identify mentioned agents
    const pTags = event.tags.filter((tag) => tag[0] === "p");
    const mentionedPubkeys = pTags.map((tag) => tag[1]);

    if (mentionedPubkeys.length > 0) {
      logInfo(chalk.gray("P-tags:  ") + chalk.cyan(`${mentionedPubkeys.length} pubkeys mentioned`));
    }

    logInfo(chalk.yellow("Chat message handling not yet implemented"));
  }

  private handleProjectStatus(event: NDKEvent): void {
    const ndk = getNDK();
    if (event.author.pubkey !== ndk.activeUser?.pubkey) {
      logInfo(chalk.gray("Status:  ") + chalk.green("Another instance is online"));
    }
  }

  private handleDefaultEvent(event: NDKEvent): void {
    if (event.content) {
      logInfo(
        chalk.gray("Content: ") +
          chalk.white(event.content.substring(0, 100) + (event.content.length > 100 ? "..." : ""))
      );
    }
  }

  private async handleProjectEvent(event: NDKEvent): Promise<void> {
    this.logProjectUpdate(event);
    const agentEventIds = this.extractAgentEventIds(event);

    if (agentEventIds.length > 0) {
      logInfo(`Processing ${agentEventIds.length} agent(s)`);
      await this.fetchAndSaveAgents(agentEventIds);
    }

    // Update project configuration if details have changed
    const newTitle = event.tags.find((tag) => tag[0] === "title")?.[1];
    const newDescription = event.content;
    const newRepo = event.tags.find((tag) => tag[0] === "repo")?.[1];

    let configUpdated = false;
    const configPath = path.join(this.projectInfo.projectPath, "config.json");

    try {
      const configContent = await readFile(configPath, "utf-8");
      const configData = JSON.parse(configContent);
      const config = { ...configData };

      if (newTitle && newTitle !== config.title) {
        config.title = newTitle;
        this.projectInfo.title = newTitle;
        configUpdated = true;
      }

      if (newDescription && newDescription !== config.description) {
        config.description = newDescription;
        configUpdated = true;
      }

      if (newRepo && newRepo !== config.repository) {
        config.repository = newRepo;
        this.projectInfo.repository = newRepo;
        configUpdated = true;
      }

      if (configUpdated) {
        await writeJsonFile(configPath, config);
        logInfo(chalk.green("✅ Updated project configuration"));

        // Project context update would happen here if needed
      }
    } catch (error) {
      logInfo(chalk.yellow(`⚠️  Could not update config.json: ${formatError(error)}`));
    }
  }

  private logProjectUpdate(event: NDKEvent): void {
    const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled";
    logInfo(`📋 Project event update received: ${title}`);
  }

  private extractAgentEventIds(event: NDKEvent): string[] {
    return event.tags
      .filter((tag) => tag[0] === "agent" && tag[1])
      .map((tag) => tag[1])
      .filter((id): id is string => Boolean(id));
  }

  private async fetchAndSaveAgents(agentEventIds: string[]): Promise<void> {
    const agentsDir = path.join(this.projectInfo.projectPath, ".tenex", "agents");

    // Ensure agents directory exists
    await ensureDirectory(agentsDir);

    for (const agentEventId of agentEventIds) {
      const agentConfigPath = path.join(agentsDir, `${agentEventId}.json`);

      // Check if we already have this agent definition
      if (await fileExists(agentConfigPath)) {
        continue; // Already have it
      }

      try {
        const ndk = getNDK();
        const agentEvent = await ndk.fetchEvent(agentEventId);

        if (agentEvent && agentEvent.kind === EVENT_KINDS.AGENT_CONFIG) {
          const agentName = agentEvent.tagValue("title") || "unnamed";
          const agentConfig = {
            eventId: agentEventId,
            name: agentName,
            description: agentEvent.tagValue("description"),
            role: agentEvent.tagValue("role"),
            instructions: agentEvent.tagValue("instructions"),
            version: (() => {
              const versionStr = agentEvent.tagValue("version");
              if (!versionStr) return 1;
              const parsed = Number.parseInt(versionStr, 10);
              return Number.isNaN(parsed) ? 1 : parsed;
            })(),
            publishedAt: agentEvent.created_at,
            publisher: agentEvent.pubkey,
          };

          await writeJsonFile(agentConfigPath, agentConfig);
          logInfo(chalk.green(`✅ Saved new agent definition: ${agentName}`));

          // Ensure this agent has an nsec in agents.json
          await this.ensureAgentNsec(agentName, agentEventId);
        }
      } catch (err) {
        const errorMessage = formatError(err);
        logInfo(chalk.red(`Failed to fetch agent ${agentEventId}: ${errorMessage}`));
      }
    }
  }

  private async ensureAgentNsec(agentName: string, agentEventId: string): Promise<void> {
    try {
      const config: AgentConfig = {
        name: agentName,
        role: "agent", // Default role
        expertise: "agent", // Default expertise
        instructions: "", // Will be populated from agent event
        nsec: "", // Will be generated by ensureAgent
        eventId: agentEventId,
        pubkey: "", // Will be generated by ensureAgent
        tools: [],
      };

      await this.agentRegistry.ensureAgent(agentName, config);
      logInfo(chalk.green(`✅ Ensured agent exists: ${agentName}`));
    } catch (err) {
      const errorMessage = formatError(err);
      logInfo(chalk.red(`Failed to create agent ${agentName}: ${errorMessage}`));
    }
  }

  private async handleNewConversation(event: NDKEvent): Promise<void> {
    const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "New Conversation";
    logInfo(chalk.green(`\n🗣️  New conversation started: ${title}`));
    logInfo(chalk.gray("Content: ") + chalk.white(event.content));

    try {
      // Get all available agents from the registry
      const availableAgents = await this.agentRegistry.getAllAgents();

      // Route the new conversation through the routing system
      await this.conversationRouter.routeNewConversation(event, availableAgents);

      logInfo(chalk.green("✅ Conversation routed successfully"));
    } catch (error) {
      logInfo(chalk.red(`❌ Failed to route conversation: ${formatError(error)}`));
    }
  }

  async cleanup(): Promise<void> {
    // Save all conversations before shutting down
    await this.conversationManager.cleanup();
    logInfo("EventHandler cleanup completed");
  }
}
