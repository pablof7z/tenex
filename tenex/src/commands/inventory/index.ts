import * as path from "node:path";
import { generateInventory, updateInventory } from "@/utils/inventory";
import { logger } from "@/utils/logger";
import { ensureProjectInitialized } from "@/utils/projectInitialization";
import { Command } from "commander";

export const inventoryCommand = new Command("inventory")
  .description("Manage project inventory")
  .action(() => {
    inventoryCommand.help();
  });

inventoryCommand
  .command("generate")
  .description("Generate or update the project inventory using repomix + LLM analysis")
  .option("--path <path>", "Project path (defaults to current directory)")
  .action(async (options) => {
    try {
      const projectPath = options.path || process.cwd();

      // Initialize project context
      await ensureProjectInitialized(projectPath);

      logger.info("Generating project inventory", { projectPath });

      await generateInventory(projectPath);

      console.log("\n✅ Inventory generation completed successfully!");
      console.log("📋 Main inventory saved to context/INVENTORY.md");
      console.log("📚 Complex module guides (if any) saved to context/ directory");
    } catch (error) {
      logger.error("Failed to generate inventory", { error });
      process.exit(1);
    }
  });

inventoryCommand
  .command("update")
  .description("Update inventory for specific files using repomix + LLM analysis")
  .argument("<files...>", "Files to update in the inventory")
  .option("--path <path>", "Project path (defaults to current directory)")
  .action(async (files, options) => {
    try {
      const projectPath = options.path || process.cwd();

      // Initialize project context
      await ensureProjectInitialized(projectPath);

      logger.info("Updating inventory for files", { files });

      await updateInventory(projectPath, files);

      console.log("\n✅ Inventory update completed successfully!");
      console.log(`📝 Updated inventory for ${files.length} file(s)`);
      console.log("📋 Updated inventory saved to context/INVENTORY.md");
    } catch (error) {
      logger.error("Failed to update inventory", { error });
      process.exit(1);
    }
  });
