import path from "node:path";
import { EventHandler } from "@/commands/run/EventHandler";
import { ProjectDisplay } from "@/commands/run/ProjectDisplay";
import { type ProjectInfo, ProjectLoader } from "@/commands/run/ProjectLoader";
import { StatusPublisher } from "@/commands/run/StatusPublisher";
import { SubscriptionManager } from "@/commands/run/SubscriptionManager";
import { STARTUP_FILTER_MINUTES } from "@/commands/run/constants";
import { getNDK, initNDK, shutdownNDK } from "@/nostr/ndkClient";
import { getAgentSigner } from "@/utils/agentManager";
import { formatError } from "@/utils/errors";
import type NDK from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";
import chalk from "chalk";
import { Command } from "commander";

export const projectRunCommand = new Command("run")
    .description("Run the TENEX agent orchestration system for the current project")
    .option("-p, --path <path>", "Project path", process.cwd())
    .action(async (options) => {
        try {
            const projectPath = path.resolve(options.path);

            // Initialize NDK and get singleton
            await initNDK();
            const ndk = getNDK();

            // Load project using ProjectLoader (which includes fetching the project event)
            const projectLoader = new ProjectLoader(ndk);
            const projectInfo = await projectLoader.loadProject(projectPath);

            // Display project information
            const projectDisplay = new ProjectDisplay(ndk);
            await projectDisplay.displayProjectInfo(projectInfo);

            // Start the project listener
            await runProjectListener(projectInfo, ndk);
        } catch (err) {
            const errorMessage = formatError(err);
            logger.error(`Failed to start project: ${errorMessage}`);
            process.exit(1);
        }
    });

async function runProjectListener(projectInfo: ProjectInfo, ndk: NDK) {
    try {
        logger.info(
            `Starting listener for project: ${projectInfo.title} (${projectInfo.projectId})`
        );

        // Set up agent signer - use primary agent
        const { signer } = await getAgentSigner(projectInfo.projectPath);
        ndk.signer = signer;

        // Initialize event handler
        const eventHandler = new EventHandler(projectInfo);
        await eventHandler.initialize();

        // Initialize subscription manager
        const subscriptionManager = new SubscriptionManager(eventHandler, projectInfo);
        await subscriptionManager.start();

        // Start status publisher
        const statusPublisher = new StatusPublisher();
        await statusPublisher.startPublishing(projectInfo);

        logger.success(
            `Project listener active. Monitoring events from the last ${STARTUP_FILTER_MINUTES} minutes.`
        );
        logger.info(chalk.green("\n✅ Ready to process events!\n"));

        // Set up graceful shutdown
        setupGracefulShutdown(eventHandler, statusPublisher, subscriptionManager);

        // Keep the process running
        await new Promise(() => {
            // This promise never resolves, keeping the listener active
        });
    } catch (err) {
        const errorMessage = formatError(err);
        logger.error(`Failed to run project listener: ${errorMessage}`);
        throw err;
    }
}

function setupGracefulShutdown(
    eventHandler: EventHandler,
    statusPublisher: StatusPublisher,
    subscriptionManager: SubscriptionManager
) {
    const shutdown = async (signal: string) => {
        logger.info(`Received ${signal}, shutting down gracefully...`);

        try {
            // Stop subscriptions first
            await subscriptionManager.stop();

            // Stop status publisher
            statusPublisher.stopPublishing();

            // Clean up event handler subscriptions
            await eventHandler.cleanup();

            // Shutdown NDK singleton
            await shutdownNDK();

            logger.info("Project shutdown complete");
            process.exit(0);
        } catch (error) {
            logger.error("Error during shutdown", { error });
            process.exit(1);
        }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGHUP", () => shutdown("SIGHUP"));
}
