import type { EventHandler } from "@/commands/run/EventHandler";
import { STARTUP_FILTER_MINUTES } from "@/commands/run/constants";
import { getProjectContext } from "@/services";
import {
  addProcessedEvent,
  clearProcessedEvents,
  flushProcessedEvents,
  hasProcessedEvent,
  loadProcessedEvents,
} from "@/commands/run/processedEventTracking";
import { getNDK } from "@/nostr/ndkClient";
import type { NDKEvent, NDKFilter, NDKSubscription } from "@nostr-dev-kit/ndk";
import type { NDKKind } from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";
import { EVENT_KINDS } from "@/llm/types";
import chalk from "chalk";

export class SubscriptionManager {
  private subscriptions: NDKSubscription[] = [];
  private eventHandler: EventHandler;
  private projectPath: string;

  constructor(eventHandler: EventHandler, projectPath: string) {
    this.eventHandler = eventHandler;
    this.projectPath = projectPath;
  }

  async start(): Promise<void> {
    logger.info(chalk.cyan("📡 Setting up project subscriptions..."));

    // Load previously processed event IDs from disk
    await loadProcessedEvents(this.projectPath);

    // 1. Subscribe to project updates (NDKProject events)
    await this.subscribeToProjectUpdates();

    // 3. Subscribe to all project-related events
    await this.subscribeToProjectEvents();

    logger.info(chalk.green("✅ All subscriptions active"));
    logger.info(chalk.gray(`Monitoring events from the last ${STARTUP_FILTER_MINUTES} minutes`));
  }

  private async subscribeToProjectUpdates(): Promise<void> {
    const projectCtx = getProjectContext();
    const project = projectCtx.project;
    const projectFilter = project.filter();

    logger.info(chalk.blue("  • Setting up project update subscription..."));
    logger.debug("Project update filter:", projectFilter);

    const ndk = getNDK();
    const projectSubscription = ndk.subscribe(projectFilter, {
      closeOnEose: false,
      groupable: false,
    });

    projectSubscription.on("event", (event: NDKEvent) => {
      this.handleIncomingEvent(event, "project update");
    });

    this.subscriptions.push(projectSubscription);
    logger.info(chalk.green("    ✓ Project update subscription active"));
  }

  private async subscribeToProjectEvents(): Promise<void> {
    // Filter for all events that tag this project
    const projectCtx = getProjectContext();
    const project = projectCtx.project;
    const projectTagFilter: NDKFilter = {
      ...project.filter(),
      limit: 1,
    };

    logger.info(chalk.blue("  • Setting up project event subscription..."));
    logger.debug("Project event filter:", projectTagFilter);

    const ndk = getNDK();
    const projectEventSubscription = ndk.subscribe(
      projectTagFilter,
      {
        closeOnEose: false,
        groupable: false,
      },
      {
        onEvent: (event: NDKEvent) => {
          this.handleIncomingEvent(event, "project event");
        },
      }
    );

    this.subscriptions.push(projectEventSubscription);
    logger.info(chalk.green("    ✓ Project event subscription active"));
  }

  private async handleIncomingEvent(event: NDKEvent, source: string): Promise<void> {
    // Check for duplicate events
    if (hasProcessedEvent(event.id)) {
      logger.debug(`Skipping duplicate event ${event.id} from ${source}`);
      return;
    }

    // Mark as processed
    addProcessedEvent(this.projectPath, event.id);

    // Log receipt
    if (event.kind !== EVENT_KINDS.PROJECT_STATUS) {
      logger.info(chalk.gray(`\n📥 Received ${source}: ${event.kind}`));
      logger.debug(`Event kind: ${event.kind}, author: ${event.author.npub}`);

      // Pass to event handler
      try {
        await this.eventHandler.handleEvent(event);
      } catch (error) {
        logger.error(`Error handling event from ${source}:`, error);
      }
    }
  }

  async stop(): Promise<void> {
    logger.info("Stopping subscriptions...");

    for (const subscription of this.subscriptions) {
      subscription.stop();
    }

    this.subscriptions = [];

    // Flush any pending saves to disk before stopping
    await flushProcessedEvents(this.projectPath);
    clearProcessedEvents();

    logger.info("All subscriptions stopped");
  }
}
