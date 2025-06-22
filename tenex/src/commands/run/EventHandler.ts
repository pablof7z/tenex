import { getEventKindName } from "@/commands/run/constants";
import { ConversationManager } from "@/conversations";
import { LLMServiceManager } from "@/core/llm/LLMServiceManager";
import type { LLMService } from "@/core/llm/types";
import { ConversationPublisher } from "@/nostr";
import { getNDK } from "@/nostr/ndkClient";
import { ConversationRouter, RoutingLLM } from "@/routing";
import { formatError } from "@/utils/errors";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";
const logInfo = logger.info.bind(logger);
import { configService, projectContext } from "@/services";
import { EVENT_KINDS } from "@/types/llm";
import type { TenexLLMs } from "@/types/config";
import chalk from "chalk";

export class EventHandler {
  private conversationManager: ConversationManager;
  private llmSettings!: TenexLLMs;
  private llmService!: LLMService;
  private routingLLM!: RoutingLLM;
  private conversationRouter!: ConversationRouter;
  private conversationPublisher!: ConversationPublisher;

  constructor(private projectPath: string) {
    this.conversationManager = new ConversationManager(projectPath);
  }

  async initialize(): Promise<void> {
    // Initialize conversation manager
    await this.conversationManager.initialize();

    // Load LLM configuration from ConfigService
    const { llms } = await configService.loadConfig(this.projectPath);
    this.llmSettings = llms;

    // Use LLMServiceManager to create the LLM service
    this.llmService = await LLMServiceManager.create(this.projectPath);

    // Initialize routing system
    let routingConfig = "default";
    try {
      routingConfig =
        this.llmSettings.defaults?.routing || this.llmSettings.defaults?.agents || "default";
    } catch {
      routingConfig = "default";
    }
    this.routingLLM = new RoutingLLM(this.llmService, routingConfig, this.projectPath);
    logInfo(`Initialized RoutingLLM with configuration: ${routingConfig}`);

    // Get project and agents from ProjectContext
    const project = projectContext.getCurrentProject();
    const projectNsec = projectContext.getCurrentProjectNsec();
    const agents = projectContext.getAllAgents();

    // Create project context for ConversationPublisher
    const projectInfo = {
      projectEvent: project,
      projectSigner: { pubkey: project.pubkey, nsec: projectNsec },
      agents: agents,
      projectPath: this.projectPath,
      title: project.tagValue("title") || "Untitled Project",
      repository: project.tagValue("repo") || "",
    };

    this.conversationPublisher = new ConversationPublisher(getNDK());
    this.conversationRouter = new ConversationRouter(
      this.conversationManager,
      this.routingLLM,
      this.conversationPublisher,
      this.llmService
    );

    // Verify project event ID
    if (!project.id) {
      throw new Error("Project event ID is required but was not found");
    }

    logInfo("EventHandler initialized with conversation routing support");
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
      const project = projectContext.getCurrentProject();
      const agents = projectContext.getAllAgents();
      const systemPubkeys = new Set([
        project.pubkey,
        ...Array.from(agents.values()).map((a) => a.pubkey),
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
        // Get all available agents from project context
        const availableAgents = Array.from(projectContext.getAllAgents().values());

        // Route the new conversation through the routing LLM
        await this.conversationRouter.routeNewConversation(event, availableAgents);

        logInfo(chalk.green("✅ New conversation routed successfully"));
      } catch (error) {
        logInfo(chalk.red(`❌ Failed to route new conversation: ${formatError(error)}`));
      }
    } else {
      // This is a reply within an existing conversation
      try {
        const availableAgents = Array.from(projectContext.getAllAgents().values());
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
    const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled";
    logInfo(`📋 Project event update received: ${title}`);

    // Log what changed for informational purposes
    const agentEventIds = event.tags
      .filter((tag) => tag[0] === "agent" && tag[1])
      .map((tag) => tag[1]);

    if (agentEventIds.length > 0) {
      logInfo(`Project references ${agentEventIds.length} agent(s)`);
    }

    // Note: Configuration updates should be handled by a separate service
    // that monitors project events and updates the local state accordingly.
    // EventHandler should only process events, not modify local files.
  }

  private async handleNewConversation(event: NDKEvent): Promise<void> {
    const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "New Conversation";
    logInfo(chalk.green(`\n🗣️  New conversation started: ${title}`));
    logInfo(chalk.gray("Content: ") + chalk.white(event.content));

    try {
      // Get all available agents from project context
      const availableAgents = Array.from(projectContext.getAllAgents().values());

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
