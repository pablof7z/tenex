import path from "node:path";
import { EventHandler } from "@/event-handler";
import { ProjectDisplay } from "@/commands/run/ProjectDisplay";
import { StatusPublisher } from "@/commands/run/StatusPublisher";
import { SubscriptionManager } from "@/commands/run/SubscriptionManager";
import { STARTUP_FILTER_MINUTES } from "@/commands/run/constants";
import { getNDK, shutdownNDK } from "@/nostr/ndkClient";
import { ensureProjectInitialized } from "@/utils/projectInitialization";
import { formatError } from "@/utils/errors";
import type NDK from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";
import chalk from "chalk";
import { Command } from "commander";
import { getProjectContext } from "@/services";
import { setupGracefulShutdown } from "@/utils/process";
import { loadLLMRouter } from "@/llm";

export const projectRunCommand = new Command("run")
    .description("Run the TENEX agent orchestration system for the current project")
    .option("-p, --path <path>", "Project path", process.cwd())
    .action(async (options) => {
        try {
            const projectPath = path.resolve(options.path);

            // Initialize project context (includes NDK setup)
            await ensureProjectInitialized(projectPath);
            const ndk = getNDK();

            // Display project information
            const projectDisplay = new ProjectDisplay();
            await projectDisplay.displayProjectInfo(projectPath);

            // Start the project listener
            await runProjectListener(projectPath, ndk);
        } catch (err) {
            const errorMessage = formatError(err);
            logger.error(`Failed to start project: ${errorMessage}`);
            process.exit(1);
        }
    });

async function runProjectListener(projectPath: string, ndk: NDK) {
    try {
        const projectCtx = getProjectContext();
        const project = projectCtx.project;
        const titleTag = project.tagValue("title") || "Untitled Project";
        const dTag = project.tagValue("d") || "";
        logger.info(`Starting listener for project: ${titleTag} (${dTag})`);

        // Load LLM router
        const llmService = await loadLLMRouter(projectPath);

        // Initialize event handler
        const eventHandler = new EventHandler(projectPath, llmService, ndk);
        await eventHandler.initialize();

        // Initialize subscription manager
        const subscriptionManager = new SubscriptionManager(eventHandler, projectPath);
        await subscriptionManager.start();

        // Start status publisher
        const statusPublisher = new StatusPublisher();
        await statusPublisher.startPublishing(projectPath);

        logger.success(
            `Project listener active. Monitoring events from the last ${STARTUP_FILTER_MINUTES} minutes.`
        );
        logger.info(chalk.green("\n✅ Ready to process events!\n"));

        // Set up graceful shutdown
        setupGracefulShutdown(async () => {
            // Stop subscriptions first
            await subscriptionManager.stop();

            // Stop status publisher
            statusPublisher.stopPublishing();

            // Clean up event handler subscriptions
            await eventHandler.cleanup();

            // Shutdown NDK singleton
            await shutdownNDK();

            logger.info("Project shutdown complete");
        });

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
