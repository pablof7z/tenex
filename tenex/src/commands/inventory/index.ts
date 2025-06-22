import * as path from "node:path";
import { ProjectLoader } from "@/commands/run/ProjectLoader";
import { getNDK } from "@/nostr/ndkClient";
import { getProjectContext, initializeProjectContext } from "@/runtime";
import { generateInventory, updateInventory } from "@/utils/inventory";
import { logger } from "@/utils/logger";
import { Command } from "commander";

export const inventoryCommand = new Command("inventory")
  .description("Manage project inventory")
  .action(() => {
    inventoryCommand.help();
  });

inventoryCommand
  .command("generate")
  .description("Generate or update the project inventory using Claude Code")
  .option("--path <path>", "Project path (defaults to current directory)")
  .action(async (options) => {
    try {
      const projectPath = options.path || process.cwd();

      // Initialize runtime
      const projectLoader = new ProjectLoader();
      const projectInfo = await projectLoader.loadProject(projectPath);
      initializeProjectContext({
        projectEvent: projectInfo.projectEvent,
        projectSigner: projectInfo.projectSigner,
        agents: projectInfo.agents,
        projectPath: projectInfo.projectPath,
        title: projectInfo.title,
        repository: projectInfo.repository,
      });
      const projectContext = getProjectContext();

      logger.info("Generating project inventory", { projectPath });

      await generateInventory(
        projectPath,
        projectContext.projectSigner,
        "manual-inventory-generation"
      );

      console.log("\nInventory generation started with Claude Code.");
      console.log("Claude will analyze your project and create a comprehensive inventory.");
    } catch (error) {
      logger.error("Failed to generate inventory", { error });
      process.exit(1);
    }
  });

inventoryCommand
  .command("update")
  .description("Update inventory for specific files using Claude Code")
  .argument("<files...>", "Files to update in the inventory")
  .option("--path <path>", "Project path (defaults to current directory)")
  .action(async (files, options) => {
    try {
      const projectPath = options.path || process.cwd();

      // Initialize runtime
      const projectLoader = new ProjectLoader();
      const projectInfo = await projectLoader.loadProject(projectPath);
      initializeProjectContext({
        projectEvent: projectInfo.projectEvent,
        projectSigner: projectInfo.projectSigner,
        agents: projectInfo.agents,
        projectPath: projectInfo.projectPath,
        title: projectInfo.title,
        repository: projectInfo.repository,
      });
      const projectContext = getProjectContext();

      logger.info("Updating inventory for files", { files });

      await updateInventory(
        projectPath,
        files,
        projectContext.projectSigner,
        "manual-inventory-update"
      );

      console.log("\nInventory update started with Claude Code.");
      console.log(`Claude will update the inventory for ${files.length} file(s).`);
    } catch (error) {
      logger.error("Failed to update inventory", { error });
      process.exit(1);
    }
  });
