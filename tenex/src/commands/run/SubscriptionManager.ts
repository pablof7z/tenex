import type { EventHandler } from "@/commands/run/EventHandler";
import {
    loadProcessedEvents,
    hasProcessedEvent,
    addProcessedEvent,
    flushProcessedEvents,
    clearProcessedEvents
} from "@/commands/run/processedEventTracking";
import type { ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import { STARTUP_FILTER_MINUTES } from "@/commands/run/constants";
import { getNDK } from "@/nostr/ndkClient";
import {
    NDKArticle,
    type NDKEvent,
    type NDKFilter,
    type NDKSubscription,
} from "@nostr-dev-kit/ndk";
import type { NDKKind } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";
import { EVENT_KINDS } from "@tenex/types/events";
import chalk from "chalk";

export class SubscriptionManager {
    private subscriptions: NDKSubscription[] = [];
    private eventHandler: EventHandler;
    private projectInfo: ProjectRuntimeInfo;

    constructor(eventHandler: EventHandler, projectInfo: ProjectRuntimeInfo) {
        this.eventHandler = eventHandler;
        this.projectInfo = projectInfo;
    }

    async start(): Promise<void> {
        logger.info(chalk.cyan("📡 Setting up project subscriptions..."));

        // Load previously processed event IDs from disk
        await loadProcessedEvents(this.projectInfo.projectPath);

        // Calculate the "since" timestamp for startup (5 seconds ago)
        const startupSince = Math.floor(Date.now() / 1000) - 5;

        // 1. Subscribe to project updates (NDKProject events)
        await this.subscribeToProjectUpdates();

        // 2. Subscribe to spec documents (kind 30023)
        await this.subscribeToSpecDocuments();

        // 3. Subscribe to all project-related events
        await this.subscribeToProjectEvents(startupSince);

        logger.info(chalk.green("✅ All subscriptions active"));
        logger.info(
            chalk.gray(`Monitoring events from the last ${STARTUP_FILTER_MINUTES} minutes`)
        );
    }

    private async subscribeToProjectUpdates(): Promise<void> {
        const projectFilter = this.projectInfo.projectEvent.filter();

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

    private async subscribeToSpecDocuments(): Promise<void> {
        // Filter for spec documents (kind 30023) that tag this project
        const specFilter: NDKFilter = {
            kinds: NDKArticle.kinds,
            authors: [this.projectInfo.projectSigner.pubkey],
            ...this.projectInfo.projectEvent.filter(),
        };

        logger.info(chalk.blue("  • Setting up spec document subscription..."));
        logger.debug("Spec document filter:", specFilter);

        const ndk = getNDK();
        const specSubscription = ndk.subscribe(specFilter, {
            closeOnEose: false,
            groupable: false,
            wrap: true,
        });

        specSubscription.on("event", (event: NDKEvent) => {
            this.handleIncomingEvent(event, "spec document");
        });

        this.subscriptions.push(specSubscription);
        logger.info(chalk.green("    ✓ Spec document subscription active"));
    }

    private async subscribeToProjectEvents(since: number): Promise<void> {
        // Filter for all events that tag this project
        const projectTagFilter: NDKFilter = {
            ...this.projectInfo.projectEvent.filter(),
            since,
            limit: 5,
        };

        logger.info(chalk.blue("  • Setting up project event subscription..."));
        logger.debug("Project event filter:", projectTagFilter);

        const ndk = getNDK();
        const projectEventSubscription = ndk.subscribe(projectTagFilter, {
            closeOnEose: false,
            groupable: false,
        });

        projectEventSubscription.on("event", (event: NDKEvent) => {
            this.handleIncomingEvent(event, "project event");
        });

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
        addProcessedEvent(this.projectInfo.projectPath, event.id);

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
        await flushProcessedEvents(this.projectInfo.projectPath);
        clearProcessedEvents();

        logger.info("All subscriptions stopped");
    }
}
