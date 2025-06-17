import path from "node:path";
import { EventMonitor } from "@/core/EventMonitor";
import { ProcessManager } from "@/core/ProcessManager";
import { ProjectManager } from "@/core/ProjectManager";
import { getNDK, initNDK, shutdownNDK } from "@/nostr/ndkClient";
import { runInteractiveSetup } from "@/utils/setup";
import { logger } from "@tenex/shared";
import { configurationService } from "@tenex/shared/services";
import type { GlobalConfig } from "@tenex/types/config";
import { Command } from "commander";

export const daemonCommand = new Command("daemon")
    .description("Start the TENEX daemon to monitor Nostr events")
    .option("-w, --whitelist <pubkeys>", "Comma-separated list of whitelisted pubkeys")
    .option("-c, --config <path>", "Path to config file")
    .action(async (options) => {
        logger.info("Starting TENEX daemon");

        // Load configuration
        let globalConfig = await loadDaemonConfig(options.config);

        // Get whitelisted pubkeys
        let whitelistedPubkeys = getWhitelistedPubkeys(options.whitelist, globalConfig);

        if (whitelistedPubkeys.length === 0) {
            logger.info("No whitelisted pubkeys found. Starting interactive setup...");

            // Run interactive setup
            const setupConfig = await runInteractiveSetup();

            // Use the setup configuration
            globalConfig = setupConfig;
            whitelistedPubkeys = setupConfig.whitelistedPubkeys;
        }

        logger.info("Whitelisted pubkeys", { count: whitelistedPubkeys.length });

        // Initialize NDK and get singleton
        await initNDK();

        // Initialize core components
        const projectManager = new ProjectManager();
        const processManager = new ProcessManager();
        const eventMonitor = new EventMonitor(projectManager, processManager);

        // Set up graceful shutdown
        setupGracefulShutdown(eventMonitor, processManager);

        try {
            // Start monitoring without passing LLM configs - let projects load from global config with proper default detection
            await eventMonitor.start(whitelistedPubkeys);

            logger.info("TENEX daemon is running. Press Ctrl+C to stop.");

            // Keep the process alive
            await new Promise(() => {
                // This promise never resolves, keeping the daemon running
            });
        } catch (error) {
            logger.error("Failed to start daemon", { error });
            process.exit(1);
        }
    });

async function loadDaemonConfig(configPath?: string): Promise<GlobalConfig> {
    try {
        // If config path is provided, construct the proper context path
        const contextPath = configPath ? path.dirname(configPath) : "";
        const configuration = await configurationService.loadConfiguration(contextPath, true);

        return configuration.config as GlobalConfig;
    } catch (_error) {
        // Config doesn't exist yet
        return {};
    }
}

function getWhitelistedPubkeys(cliOption?: string, config?: GlobalConfig): string[] {
    const pubkeys: Set<string> = new Set();

    // If CLI option is provided, ONLY use those pubkeys (don't merge with config)
    if (cliOption) {
        for (const pk of cliOption.split(",")) {
            const trimmed = pk.trim();
            if (trimmed) pubkeys.add(trimmed);
        }
        return Array.from(pubkeys);
    }

    // Otherwise, use config pubkeys
    if (config?.whitelistedPubkeys) {
        if (Array.isArray(config.whitelistedPubkeys)) {
            for (const pk of config.whitelistedPubkeys) {
                if (pk) pubkeys.add(pk);
            }
        }
    }

    return Array.from(pubkeys);
}

function setupGracefulShutdown(eventMonitor: EventMonitor, processManager: ProcessManager): void {
    let isShuttingDown = false;

    const shutdown = async (signal: string) => {
        if (isShuttingDown) return;
        isShuttingDown = true;

        logger.info(`Received ${signal}, shutting down gracefully...`);

        try {
            // Stop monitoring new events
            await eventMonitor.stop();

            // Stop all running projects
            await processManager.stopAll();

            // Shutdown NDK singleton
            await shutdownNDK();

            logger.info("Daemon shutdown complete");
            process.exit(0);
        } catch (error) {
            logger.error("Error during shutdown", { error });
            process.exit(1);
        }
    };

    // Handle various termination signals
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGHUP", () => shutdown("SIGHUP"));

    // Handle uncaught errors
    process.on("uncaughtException", (error) => {
        logger.error("Uncaught exception", { error });
        shutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason, promise) => {
        logger.error("Unhandled rejection", { reason, promise });
        shutdown("unhandledRejection");
    });
}
