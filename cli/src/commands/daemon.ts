import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "@tenex/shared";
import { loadConfig } from "@tenex/shared";
import { Command } from "commander";
import { EventMonitor } from "../core/EventMonitor.js";
import { ProcessManager } from "../core/ProcessManager.js";
import { ProjectManager } from "../core/ProjectManager.js";
import { getNDK, shutdownNDK } from "../nostr/ndkClient.js";
import { runInteractiveSetup } from "../utils/setup.js";

interface DaemonConfig {
    whitelistedPubkeys?: string[];
    llms?: any[]; // LLMConfig[]
    [key: string]: unknown;
}

export const daemonCommand = new Command("daemon")
    .description("Start the TENEX daemon to monitor Nostr events")
    .option("-w, --whitelist <pubkeys>", "Comma-separated list of whitelisted pubkeys")
    .option("-c, --config <path>", "Path to config file")
    .action(async (options) => {
        logger.info("Starting TENEX daemon");

        // Load configuration
        let config = await loadDaemonConfig(options.config);

        // Get whitelisted pubkeys
        let whitelistedPubkeys = getWhitelistedPubkeys(options.whitelist, config);

        if (whitelistedPubkeys.length === 0) {
            logger.info("No whitelisted pubkeys found. Starting interactive setup...");
            
            // Run interactive setup
            const setupConfig = await runInteractiveSetup();
            
            // Use the setup configuration
            config = setupConfig;
            whitelistedPubkeys = setupConfig.whitelistedPubkeys;
        }

        logger.info("Whitelisted pubkeys", { count: whitelistedPubkeys.length });

        // Get NDK singleton
        const ndk = await getNDK();

        // Initialize core components
        const projectManager = new ProjectManager();
        const processManager = new ProcessManager();
        const eventMonitor = new EventMonitor(ndk, projectManager, processManager);

        // Set up graceful shutdown
        setupGracefulShutdown(eventMonitor, processManager);

        try {
            // Start monitoring with LLM configs from daemon configuration
            const llmConfigs = config.llms || [];
            await eventMonitor.start(whitelistedPubkeys, llmConfigs);

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

async function loadDaemonConfig(configPath?: string): Promise<DaemonConfig> {
    if (!configPath) {
        // Try default locations
        const defaultPaths = [
            path.join(process.cwd(), "tenex.config.json"),
            path.join(process.cwd(), ".tenex", "config.json"),
            path.join(process.env.HOME || "", ".tenex", "daemon.json"),
        ];

        for (const defaultPath of defaultPaths) {
            try {
                const content = await fs.readFile(defaultPath, "utf-8");
                logger.info("Loaded config from", { path: defaultPath });
                return JSON.parse(content);
            } catch {
                // Continue to next path
            }
        }

        return {};
    }

    try {
        const content = await fs.readFile(configPath, "utf-8");
        return JSON.parse(content);
    } catch (error) {
        logger.error("Failed to load config", { error, configPath });
        return {};
    }
}

function getWhitelistedPubkeys(cliOption?: string, config?: DaemonConfig): string[] {
    const pubkeys: Set<string> = new Set();

    // Add from CLI option
    if (cliOption) {
        for (const pk of cliOption.split(",")) {
            const trimmed = pk.trim();
            if (trimmed) pubkeys.add(trimmed);
        }
    }

    // Add from config
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
