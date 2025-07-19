import {
    addProcessedEvent,
    clearProcessedEvents,
    flushProcessedEvents,
    hasProcessedEvent,
    loadProcessedEvents,
} from "@/commands/run/processedEventTracking";
import type { EventHandler } from "@/event-handler";
import { NDKAgentLesson } from "@/events/NDKAgentLesson";
import { EVENT_KINDS } from "@/llm/types";
import { getNDK } from "@/nostr/ndkClient";
import { getProjectContext } from "@/services";
import { logLessonMetrics } from "@/utils/lessonMetrics";
import { logger } from "@/utils/logger";
import {
    type NDKEvent,
    type NDKFilter,
    type NDKSubscription,
    filterAndRelaySetFromBech32,
} from "@nostr-dev-kit/ndk";
import type { NDKKind } from "@nostr-dev-kit/ndk";
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

        // 2. Subscribe to agent lessons
        await this.subscribeToAgentLessons();

        // 3. Subscribe to all project-related events
        await this.subscribeToProjectEvents();
    }

    private async subscribeToProjectUpdates(): Promise<void> {
        const ndk = getNDK();
        const projectCtx = getProjectContext();
        const project = projectCtx.project;
        const { filter: projectFilter } = filterAndRelaySetFromBech32(project.encode(), ndk);

        logger.info(chalk.blue("  • Setting up project update subscription..."));
        logger.debug("Project update filter:", projectFilter);

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

    private async subscribeToAgentLessons(): Promise<void> {
        const ndk = getNDK();
        const projectCtx = getProjectContext();
        const project = projectCtx.project;

        // Get all agent pubkeys
        const agentPubkeys = Array.from(projectCtx.agents.values()).map((agent) => agent.pubkey);

        if (agentPubkeys.length === 0) {
            logger.warn("No agents found, skipping lesson subscription");
            return;
        }

        logger.info(chalk.blue("  • Setting up agent lessons subscription..."));

        // Create filter for agent lessons
        const lessonFilter: NDKFilter = {
            kinds: NDKAgentLesson.kinds,
            authors: agentPubkeys,
            "#a": [project.tagId()], // Scoped to this project
        };

        logger.debug("📚 Agent lessons subscription filter:", {
            kinds: lessonFilter.kinds,
            authorCount: agentPubkeys.length,
            authors: agentPubkeys,
            projectId: project.tagId(),
            projectName: project.tagValue("title") || "Untitled",
        });

        const lessonSubscription = ndk.subscribe(lessonFilter, {
            closeOnEose: false,
            groupable: false,
        });

        lessonSubscription.on("event", (event: NDKEvent) => {
            try {
                // Convert to NDKAgentLesson
                const lesson = NDKAgentLesson.from(event);

                // Add to project context
                if (lesson.pubkey) {
                    projectCtx.addLesson(lesson.pubkey, lesson);

                    // Find agent name for better logging
                    const agentName =
                        Array.from(projectCtx.agents.values()).find(
                            (a) => a.pubkey === lesson.pubkey
                        )?.name || "Unknown";

                    logger.info("📚 Received and stored agent lesson", {
                        agent: agentName,
                        agentPubkey: lesson.pubkey,
                        title: lesson.title,
                        eventId: lesson.id,
                        phase: lesson.tags.find((tag) => tag[0] === "phase")?.[1],
                        keywords:
                            lesson.tags
                                .filter((tag) => tag[0] === "t")
                                .map((tag) => tag[1])
                                .join(", ") || "none",
                        createdAt: new Date((lesson.created_at || 0) * 1000).toISOString(),
                        totalLessonsForAgent: projectCtx.getLessonsForAgent(lesson.pubkey).length,
                        totalLessonsInProject: projectCtx.getAllLessons().length,
                    });
                }
            } catch (error) {
                logger.error("Error processing agent lesson:", error);
            }
        });

        // Log initial load completion
        lessonSubscription.on("eose", () => {
            const totalLessons = projectCtx.getAllLessons().length;
            logger.info(
                chalk.green(
                    `    ✓ Agent lessons subscription active - loaded ${totalLessons} historical lessons`
                )
            );

            // Log lesson distribution
            const distribution = new Map<string, number>();
            for (const [pubkey, lessons] of projectCtx.agentLessons) {
                const agent = Array.from(projectCtx.agents.values()).find(
                    (a) => a.pubkey === pubkey
                );
                const name = agent?.name || "Unknown";
                distribution.set(name, lessons.length);
            }

            if (totalLessons > 0) {
                logger.debug("📊 Lesson distribution by agent:", Object.fromEntries(distribution));

                // Log comprehensive metrics
                logLessonMetrics(projectCtx);
            }
        });

        this.subscriptions.push(lessonSubscription);
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
