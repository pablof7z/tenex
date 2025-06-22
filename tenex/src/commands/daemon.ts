import path from "node:path";
import { EventMonitor } from "@/daemon/EventMonitor";
import { ProcessManager } from "@/daemon/ProcessManager";
import { ProjectManager } from "@/daemon/ProjectManager";
import { initNDK, shutdownNDK } from "@/nostr/ndkClient";
import { runInteractiveSetup } from "@/utils/setup";
import { logger } from "@/utils/logger";
import { configService } from "@/services";
import { Command } from "commander";
import { setupGracefulShutdown } from "@/utils/process";

export const daemonCommand = new Command("daemon")
  .description("Start the TENEX daemon to monitor Nostr events")
  .option("-w, --whitelist <pubkeys>", "Comma-separated list of whitelisted pubkeys")
  .option("-c, --config <path>", "Path to config file")
  .option("-p, --projects-path <path>", "Path to projects directory")
  .action(async (options) => {
    logger.info("Starting TENEX daemon");

    // Load configuration
    const { config: globalConfig } = await configService.loadConfig(
      options.config ? path.dirname(options.config) : undefined
    );

    // Get whitelisted pubkeys
    let whitelistedPubkeys = configService.getWhitelistedPubkeys(options.whitelist, globalConfig);

    if (whitelistedPubkeys.length === 0) {
      logger.info("No whitelisted pubkeys found. Starting interactive setup...");

      // Run interactive setup
      const setupConfig = await runInteractiveSetup();

      // Save the setup configuration and reload
      await configService.saveGlobalConfig(setupConfig);
      whitelistedPubkeys = setupConfig.whitelistedPubkeys || [];
    }

    logger.info("Whitelisted pubkeys", { count: whitelistedPubkeys.length });

    // Initialize NDK and get singleton
    await initNDK();

    // Initialize core components
    const projectManager = new ProjectManager(options.projectsPath);
    const processManager = new ProcessManager();
    const eventMonitor = new EventMonitor(projectManager, processManager);

    // Set up graceful shutdown
    setupGracefulShutdown(async () => {
      // Stop monitoring new events
      await eventMonitor.stop();

      // Stop all running projects
      await processManager.stopAll();

      // Shutdown NDK singleton
      await shutdownNDK();

      logger.info("Daemon shutdown complete");
    });

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


