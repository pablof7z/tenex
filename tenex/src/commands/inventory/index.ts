import * as path from "node:path";
import { ensureProjectInitialized } from "@/utils/projectInitialization";
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

      // Initialize project context
      await ensureProjectInitialized(projectPath);

      logger.info("Generating project inventory", { projectPath });

      await generateInventory(projectPath);

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

      // Initialize project context
      await ensureProjectInitialized(projectPath);

      logger.info("Updating inventory for files", { files });

      await updateInventory(projectPath, files);

      console.log("\nInventory update started with Claude Code.");
      console.log(`Claude will update the inventory for ${files.length} file(s).`);
    } catch (error) {
      logger.error("Failed to update inventory", { error });
      process.exit(1);
    }
  });
