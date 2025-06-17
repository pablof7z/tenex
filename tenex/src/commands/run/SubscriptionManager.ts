import type { EventHandler } from "@/commands/run/EventHandler";
import type { ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import { STARTUP_FILTER_MINUTES } from "@/commands/run/constants";
import { getNDK } from "@/nostr/ndkClient";
import type { NDKEvent, NDKFilter, NDKSubscription } from "@nostr-dev-kit/ndk";
import type { NDKKind } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";
import { EVENT_KINDS } from "@tenex/types/events";
import chalk from "chalk";

export class SubscriptionManager {
    private subscriptions: NDKSubscription[] = [];
    private processedEventIds = new Set<string>();
    private eventHandler: EventHandler;
    private projectInfo: ProjectRuntimeInfo;

    constructor(eventHandler: EventHandler, projectInfo: ProjectRuntimeInfo) {
        this.eventHandler = eventHandler;
        this.projectInfo = projectInfo;
    }

    async start(): Promise<void> {
        logger.info(chalk.cyan("📡 Setting up project subscriptions..."));

        // Calculate the "since" timestamp for startup (5 minutes ago)
        const startupSince = Math.floor(Date.now() / 1000) - STARTUP_FILTER_MINUTES * 60;

        // 1. Subscribe to project updates (NDKProject events)
        await this.subscribeToProjectUpdates(startupSince);

        // 2. Subscribe to spec documents (kind 30023)
        await this.subscribeToSpecDocuments(startupSince);

        // 3. Subscribe to all project-related events
        await this.subscribeToProjectEvents(startupSince);

        logger.info(chalk.green("✅ All subscriptions active"));
        logger.info(
            chalk.gray(`Monitoring events from the last ${STARTUP_FILTER_MINUTES} minutes`)
        );
    }

    private async subscribeToProjectUpdates(since: number): Promise<void> {
        const projectFilter: NDKFilter = {
            kinds: [this.projectInfo.projectEvent.kind as NDKKind],
            authors: [this.projectInfo.projectPubkey],
            "#d": [this.projectInfo.projectId],
            since,
        };

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

    private async subscribeToSpecDocuments(since: number): Promise<void> {
        // Filter for spec documents (kind 30023) that tag this project
        const specFilter: NDKFilter = {
            kinds: [EVENT_KINDS.ARTICLE], // 30023
            authors: [this.projectInfo.projectPubkey],
            "#a": [
                `${this.projectInfo.projectEvent.kind}:${this.projectInfo.projectPubkey}:${this.projectInfo.projectId}`,
            ],
            since,
        };

        logger.info(chalk.blue("  • Setting up spec document subscription..."));
        logger.debug("Spec document filter:", specFilter);

        const ndk = getNDK();
        const specSubscription = ndk.subscribe(specFilter, {
            closeOnEose: false,
            groupable: false,
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
            "#a": [
                `${this.projectInfo.projectEvent.kind}:${this.projectInfo.projectPubkey}:${this.projectInfo.projectId}`,
            ],
            since,
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
        if (this.processedEventIds.has(event.id)) {
            logger.debug(`Skipping duplicate event ${event.id} from ${source}`);
            return;
        }

        // Mark as processed
        this.processedEventIds.add(event.id);

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
        this.processedEventIds.clear();

        logger.info("All subscriptions stopped");
    }
}
