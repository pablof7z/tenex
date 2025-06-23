import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@/utils/logger";
import { getProjectContext, isProjectContextInitialized, configService } from "@/services";
import { ClaudeCodeExecutor } from "../tools/claude/ClaudeCodeExecutor";

const DEFAULT_INVENTORY_PATH = "context/INVENTORY.md";

/**
 * Generate inventory using Claude Code
 */
export async function generateInventory(projectPath: string): Promise<void> {
  logger.info("Generating project inventory with Claude Code", { projectPath });

  const inventoryPath = await getInventoryPath(projectPath);
  const prompt = buildGenerateInventoryPrompt(projectPath, inventoryPath);

  const executor = new ClaudeCodeExecutor({
    prompt,
    projectPath,
    timeout: 300000,
    onMessage: (message) => {
      if (message.type === "assistant") {
        logger.debug("Inventory generation message", {
          messageId: message.message_id || message.messageId,
        });
      }
    },
    onError: (error) => {
      logger.error("Inventory generation error", { error });
    },
    onComplete: (result) => {
      logger.info("Inventory generation completed", {
        sessionId: result.sessionId,
        success: result.success,
      });
    },
  });

  const result = await executor.execute();

  if (!result.success) {
    throw new Error(`Inventory generation failed: ${result.error}`);
  }
}

/**
 * Update inventory for specific files using Claude Code
 */
export async function updateInventory(projectPath: string, files: string[]): Promise<void> {
  logger.info("Updating inventory with Claude Code", { projectPath, files });

  const inventoryPath = await getInventoryPath(projectPath);
  const prompt = buildUpdateInventoryPrompt(inventoryPath, files);

  const executor = new ClaudeCodeExecutor({
    prompt,
    projectPath,
    timeout: 300000,
    onMessage: (message) => {
      if (message.type === "assistant") {
        logger.debug("Inventory update message", {
          messageId: message.message_id || message.messageId,
        });
      }
    },
    onError: (error) => {
      logger.error("Inventory update error", { error });
    },
    onComplete: (result) => {
      logger.info("Inventory update completed", {
        sessionId: result.sessionId,
        success: result.success,
      });
    },
  });

  const result = await executor.execute();

  if (!result.success) {
    throw new Error(`Inventory update failed: ${result.error}`);
  }
}

/**
 * Check if inventory exists
 */
export async function inventoryExists(projectPath: string): Promise<boolean> {
  try {
    const inventoryPath = await getInventoryPath(projectPath);
    await fs.access(inventoryPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the inventory file path
 */
async function getInventoryPath(projectPath: string): Promise<string> {
  const projectConfig = await loadProjectConfig(projectPath);
  const inventoryPath = projectConfig?.paths?.inventory || DEFAULT_INVENTORY_PATH;
  return path.join(projectPath, inventoryPath);
}

/**
 * Load project configuration
 */
async function loadProjectConfig(projectPath: string) {
  try {
    if (isProjectContextInitialized()) {
      // Get config from ProjectContext if available
      const projectCtx = getProjectContext();
      const project = projectCtx.project;
      const titleTag = project.tags.find((tag) => tag[0] === "title");
      return {
        paths: { inventory: DEFAULT_INVENTORY_PATH },
        title: titleTag?.[1] || "Untitled Project",
      };
    }
      // Fallback: try to load config directly
      const { config } = await configService.loadConfig(projectPath);
      return config;
  } catch (error) {
    logger.debug("Failed to load project config", { error });
    return { paths: { inventory: DEFAULT_INVENTORY_PATH } };
  }
}

/**
 * Build prompt for generating inventory
 */
function buildGenerateInventoryPrompt(projectPath: string, inventoryPath: string): string {
  return `Generate a comprehensive inventory for the project at ${projectPath}.

The inventory should be saved to: ${inventoryPath}

Please analyze the entire project structure and create a detailed inventory in markdown format that includes:

1. Project overview with description and detected technologies
3. Directory structure with descriptions
4. File listings with meaningful descriptions (one-liner value prop)
5. Any important patterns or architectural insights

Focus on providing value to developers who need to quickly understand the codebase.`;
}

/**
 * Build prompt for updating inventory
 */
function buildUpdateInventoryPrompt(inventoryPath: string, files: string[]): string {
  return `Update the existing inventory at ${inventoryPath} for the following changed files:

${files.map((f) => `- ${f}`).join("\n")}

Please:
1. Read the existing inventory
2. Update entries for the specified files
3. Add new files if they don't exist
4. Remove entries for deleted files
5. Update any affected statistics
6. Save the updated inventory

Maintain the existing format and structure of the inventory.`;
}
