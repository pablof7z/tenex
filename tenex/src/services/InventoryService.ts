import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@tenex/shared";
import { configurationService } from "@tenex/shared/services";
import type { ProjectConfig } from "@tenex/types/config";
import { ClaudeCodeExecutor } from "../tools/ClaudeCodeExecutor";
import type { NDKSigner } from "@nostr-dev-kit/ndk";

const DEFAULT_INVENTORY_PATH = "context/INVENTORY.md";

export class InventoryService {
  private projectPath: string;
  private inventoryPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.inventoryPath = DEFAULT_INVENTORY_PATH;
  }

  /**
   * Generate inventory using Claude Code
   */
  async generateInventory(signer: NDKSigner, conversationId: string): Promise<void> {
    logger.info("Generating project inventory with Claude Code", { projectPath: this.projectPath });

    const inventoryPath = await this.getInventoryPath();
    const prompt = this.buildGenerateInventoryPrompt(inventoryPath);

    const claudeExecutor = new ClaudeCodeExecutor({ conversationId, signer });
    
    const taskId = await claudeExecutor.execute({
      prompt,
      conversationContext: "",
      requirements: "Generate a comprehensive inventory of the project",
      phase: "inventory",
    });

    logger.info("Claude Code inventory generation started", { taskId });
  }

  /**
   * Update inventory for specific files using Claude Code
   */
  async updateInventory(files: string[], signer: NDKSigner, conversationId: string): Promise<void> {
    logger.info("Updating inventory with Claude Code", { projectPath: this.projectPath, files });

    const inventoryPath = await this.getInventoryPath();
    const prompt = this.buildUpdateInventoryPrompt(inventoryPath, files);

    const claudeExecutor = new ClaudeCodeExecutor({ conversationId, signer });
    
    const taskId = await claudeExecutor.execute({
      prompt,
      conversationContext: "",
      requirements: `Update inventory for ${files.length} files`,
      phase: "inventory",
    });

    logger.info("Claude Code inventory update started", { taskId });
  }

  /**
   * Check if inventory exists
   */
  async inventoryExists(): Promise<boolean> {
    try {
      const inventoryPath = await this.getInventoryPath();
      await fs.access(inventoryPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the inventory file path
   */
  private async getInventoryPath(): Promise<string> {
    const projectConfig = await this.loadProjectConfig();
    const inventoryPath = projectConfig?.paths?.inventory || DEFAULT_INVENTORY_PATH;
    return path.join(this.projectPath, inventoryPath);
  }

  /**
   * Load project configuration
   */
  private async loadProjectConfig(): Promise<ProjectConfig | null> {
    try {
      const config = await configurationService.loadConfiguration(this.projectPath);
      return config.config as ProjectConfig;
    } catch (error) {
      logger.debug("Failed to load project config", { error });
      return null;
    }
  }

  /**
   * Build prompt for generating inventory
   */
  private buildGenerateInventoryPrompt(inventoryPath: string): string {
    return `Generate a comprehensive inventory for the project at ${this.projectPath}.

The inventory should be saved to: ${inventoryPath}

Please analyze the entire project structure and create a detailed inventory in markdown format that includes:

1. Project overview with description and detected technologies
2. Statistics (total files, directories, sizes)
3. Directory structure with descriptions
4. File listings with meaningful descriptions
5. Any important patterns or architectural insights

Focus on providing value to developers who need to quickly understand the codebase.`;
  }

  /**
   * Build prompt for updating inventory
   */
  private buildUpdateInventoryPrompt(inventoryPath: string, files: string[]): string {
    return `Update the existing inventory at ${inventoryPath} for the following changed files:

${files.map(f => `- ${f}`).join('\n')}

Please:
1. Read the existing inventory
2. Update entries for the specified files
3. Add new files if they don't exist
4. Remove entries for deleted files
5. Update any affected statistics
6. Save the updated inventory

Maintain the existing format and structure of the inventory.`;
  }
}