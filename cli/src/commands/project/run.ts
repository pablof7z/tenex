import path from "node:path";
import type NDK from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";
import chalk from "chalk";
import { Command } from "commander";
import { getNDK, shutdownNDK } from "../../nostr/ndkClient.js";
import { getAgentSigner } from "../../utils/agentManager.js";
import { formatError } from "../../utils/errors.js";
import { EventHandler } from "../run/EventHandler.js";
import { ProjectDisplay } from "../run/ProjectDisplay.js";
import { type ProjectInfo, ProjectLoader } from "../run/ProjectLoader.js";
import { StatusPublisher } from "../run/StatusPublisher.js";
import { STARTUP_FILTER_MINUTES } from "../run/constants.js";

export const projectRunCommand = new Command("run")
    .description("Run the TENEX agent orchestration system for the current project")
    .option("-p, --path <path>", "Project path", process.cwd())
    .action(async (options) => {
        try {
            const projectPath = path.resolve(options.path);

            logger.info("Starting TENEX project listener...");
            logger.info(chalk.cyan("\n📡 Loading project configuration...\n"));

            // Get NDK singleton
            const ndk = await getNDK();

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

        // Set up agent signer
        const { signer } = await getAgentSigner(projectInfo.projectPath, "default");
        ndk.signer = signer;

        // Initialize event handler
        const eventHandler = new EventHandler(projectInfo, ndk);
        await eventHandler.initialize();

        // Start status publisher
        const statusPublisher = new StatusPublisher(ndk);
        await statusPublisher.startPublishing(projectInfo);

        logger.success(
            `Project listener active. Monitoring events from the last ${STARTUP_FILTER_MINUTES} minutes.`
        );
        logger.info(chalk.green("\n✅ Ready to process events!\n"));

        // Set up graceful shutdown
        setupGracefulShutdown(eventHandler, statusPublisher);

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

function setupGracefulShutdown(eventHandler: EventHandler, statusPublisher: StatusPublisher) {
    const shutdown = async (signal: string) => {
        logger.info(`Received ${signal}, shutting down gracefully...`);

        try {
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
