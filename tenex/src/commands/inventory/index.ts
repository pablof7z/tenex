import { Command } from "commander";
import { logger } from "@tenex/shared";
import { InventoryService } from "@/services/InventoryService";
import { AnalyzeTask } from "@/tasks/analyzeTask";
import { getProjectContext, initializeRuntime } from "@/runtime";
import { getNDK } from "@/nostr/ndkClient";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export const inventoryCommand = new Command("inventory")
  .description("Manage project inventory")
  .action(() => {
    // Show help if no subcommand
    inventoryCommand.help();
  });

inventoryCommand
  .command("generate")
  .description("Generate or update the project inventory")
  .option("--skip-claude", "Skip Claude Code enhancement", false)
  .option("--path <path>", "Project path (defaults to current directory)")
  .action(async (options) => {
    try {
      const projectPath = options.path || process.cwd();
      
      // Initialize runtime
      await initializeRuntime(projectPath);
      const projectContext = getProjectContext();
      const ndk = getNDK();

      logger.info("Generating project inventory", { projectPath });

      if (options.skipClaude) {
        // Use basic inventory service without Claude Code
        const inventoryService = new InventoryService(projectPath);
        const inventory = await inventoryService.generateInventory();
        await inventoryService.saveInventory(inventory);

        logger.info("Basic inventory generated successfully", {
          files: inventory.stats.totalFiles,
          directories: inventory.stats.totalDirectories,
          technologies: inventory.technologies,
        });
      } else {
        // Use analyze task with Claude Code enhancement
        const analyzeTask = new AnalyzeTask({
          projectPath,
          conversationId: "manual-inventory-generation",
          signer: projectContext.projectSigner,
          skipClaudeCode: false,
        });

        const inventory = await analyzeTask.execute();

        logger.info("Enhanced inventory generated successfully", {
          files: inventory.stats.totalFiles,
          directories: inventory.stats.totalDirectories,
          technologies: inventory.technologies,
        });
      }

      // Display inventory path
      const configPath = path.join(projectPath, ".tenex", "config.json");
      let inventoryPath = "context/INVENTORY.md"; // default
      
      try {
        const configContent = await fs.readFile(configPath, "utf-8");
        const config = JSON.parse(configContent);
        inventoryPath = config.paths?.inventory || inventoryPath;
      } catch {
        // Use default path
      }

      console.log(`\nInventory saved to: ${path.join(projectPath, ".tenex", inventoryPath)}`);
    } catch (error) {
      logger.error("Failed to generate inventory", { error });
      process.exit(1);
    }
  });

inventoryCommand
  .command("show")
  .description("Display the current project inventory")
  .option("--path <path>", "Project path (defaults to current directory)")
  .option("--json", "Output as JSON", false)
  .action(async (options) => {
    try {
      const projectPath = options.path || process.cwd();
      const inventoryService = new InventoryService(projectPath);
      const inventory = await inventoryService.loadInventory();

      if (!inventory) {
        console.error("No inventory found. Run 'tenex inventory generate' first.");
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(inventory, null, 2));
      } else {
        console.log(`Project Inventory for: ${inventory.projectPath}`);
        console.log(`Generated: ${new Date(inventory.generatedAt).toLocaleString()}`);
        console.log(`Description: ${inventory.projectDescription}`);
        console.log(`Technologies: ${inventory.technologies.join(", ") || "None detected"}`);
        console.log("\nStatistics:");
        console.log(`  Total Files: ${inventory.stats.totalFiles}`);
        console.log(`  Total Directories: ${inventory.stats.totalDirectories}`);
        console.log(`  Total Size: ${formatBytes(inventory.stats.totalSize)}`);
        console.log("\nFile Types:");
        
        const sortedTypes = Object.entries(inventory.stats.fileTypes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        
        for (const [type, count] of sortedTypes) {
          console.log(`  ${type}: ${count} files`);
        }

        if (inventory.directories.length > 0) {
          console.log("\nTop-Level Directories:");
          const topDirs = inventory.directories
            .filter(d => !d.path.includes("/"))
            .slice(0, 10);
          
          for (const dir of topDirs) {
            console.log(`  ${dir.path}/ - ${dir.description} (${dir.fileCount} files)`);
          }
        }
      }
    } catch (error) {
      logger.error("Failed to show inventory", { error });
      process.exit(1);
    }
  });

inventoryCommand
  .command("update")
  .description("Update inventory for specific files")
  .argument("<files...>", "Files to update in the inventory")
  .option("--path <path>", "Project path (defaults to current directory)")
  .action(async (files, options) => {
    try {
      const projectPath = options.path || process.cwd();
      
      // Initialize runtime for Claude Code access
      await initializeRuntime(projectPath);
      const projectContext = getProjectContext();

      const inventoryService = new InventoryService(projectPath);
      
      logger.info("Updating inventory for files", { files });

      const result = await inventoryService.updateInventory(files);
      await inventoryService.saveInventory(result.inventory);

      console.log("\nInventory Update Summary:");
      console.log(`  Files added: ${result.added.length}`);
      console.log(`  Files modified: ${result.modified.length}`);
      console.log(`  Files removed: ${result.removed.length}`);

      if (result.added.length > 0) {
        console.log("\nAdded files:");
        result.added.forEach(f => console.log(`  + ${f}`));
      }

      if (result.modified.length > 0) {
        console.log("\nModified files:");
        result.modified.forEach(f => console.log(`  ~ ${f}`));
      }

      if (result.removed.length > 0) {
        console.log("\nRemoved files:");
        result.removed.forEach(f => console.log(`  - ${f}`));
      }

      console.log("\nInventory updated successfully!");
    } catch (error) {
      logger.error("Failed to update inventory", { error });
      process.exit(1);
    }
  });

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}