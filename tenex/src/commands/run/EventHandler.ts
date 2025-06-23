import { getEventKindName } from "@/commands/run/constants";
import { SystemInitializer } from "@/commands/run/SystemInitializer";
import type { SystemComponents } from "@/commands/run/SystemInitializer";
import { formatError } from "@/utils/errors";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";
const logInfo = logger.info.bind(logger);
import { getProjectContext } from "@/services";
import { EVENT_KINDS } from "@/llm/types";
import { isEventFromAgent } from "@/nostr/utils";
import chalk from "chalk";

export class EventHandler {
  private systemComponents!: SystemComponents;

  constructor(private projectPath: string) {}

  async initialize(): Promise<void> {
    const systemInitializer = new SystemInitializer(this.projectPath);
    this.systemComponents = await systemInitializer.initialize();
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
      const projectCtx = getProjectContext();
      const systemPubkeys = new Set([
        projectCtx.project.pubkey,
        ...Array.from(projectCtx.agents.values()).map((a) => a.pubkey),
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
        const projectCtx = getProjectContext();
        const availableAgents = Array.from(projectCtx.agents.values());

        // Route the new conversation through the routing LLM
        await this.systemComponents.conversationRouter.routeNewConversation(event, availableAgents);

        logInfo(chalk.green("✅ New conversation routed successfully"));
      } catch (error) {
        logInfo(chalk.red(`❌ Failed to route new conversation: ${formatError(error)}`));
      }
    } else {
      // This is a reply within an existing conversation
      try {
        const projectCtx = getProjectContext();
        const availableAgents = Array.from(projectCtx.agents.values());
        await this.systemComponents.conversationRouter.routeReply(event, availableAgents);
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
    const projectCtx = getProjectContext();
    if (event.author.pubkey !== projectCtx.project.pubkey) {
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
      const projectCtx = getProjectContext();
      const availableAgents = Array.from(projectCtx.agents.values());

      // Route the new conversation through the routing system
      await this.systemComponents.conversationRouter.routeNewConversation(event, availableAgents);

      logInfo(chalk.green("✅ Conversation routed successfully"));
    } catch (error) {
      logInfo(chalk.red(`❌ Failed to route conversation: ${formatError(error)}`));
    }
  }

  async cleanup(): Promise<void> {
    // Save all conversations before shutting down
    await this.systemComponents.conversationManager.cleanup();
    logInfo("EventHandler cleanup completed");
  }
}
