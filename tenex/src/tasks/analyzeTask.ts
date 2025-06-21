import type { NDKSigner } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";
import type { InventoryAnalysisRequest, ProjectInventory } from "@tenex/types/inventory";
import { InventoryService } from "../services/InventoryService";
import { ClaudeCodeExecutor } from "../tools/ClaudeCodeExecutor";

export interface AnalyzeTaskOptions {
  projectPath: string;
  conversationId: string;
  signer: NDKSigner;
  targetFiles?: string[];
  skipClaudeCode?: boolean;
}

export class AnalyzeTask {
  private inventoryService: InventoryService;
  private claudeCodeExecutor?: ClaudeCodeExecutor;

  constructor(private options: AnalyzeTaskOptions) {
    this.inventoryService = new InventoryService(options.projectPath);

    if (!options.skipClaudeCode && options.signer) {
      this.claudeCodeExecutor = new ClaudeCodeExecutor({
        conversationId: options.conversationId,
        signer: options.signer,
      });
    }
  }

  /**
   * Execute the analyze task
   */
  async execute(): Promise<ProjectInventory> {
    logger.info("Starting analyze task", {
      projectPath: this.options.projectPath,
      targetFiles: this.options.targetFiles?.length,
    });

    try {
      if (this.options.targetFiles) {
        // Partial update for specific files
        return await this.updateInventory(this.options.targetFiles);
      } else {
        // Full inventory generation
        return await this.generateFullInventory();
      }
    } catch (error) {
      logger.error("Analyze task failed", { error });
      throw error;
    }
  }

  /**
   * Generate full inventory using Claude Code
   */
  private async generateFullInventory(): Promise<ProjectInventory> {
    // First, do a basic scan to get file structure
    const basicInventory = await this.inventoryService.generateInventory();

    // If Claude Code is available, enhance descriptions
    if (this.claudeCodeExecutor) {
      const enhancedInventory = await this.enhanceWithClaudeCode(basicInventory);
      await this.inventoryService.saveInventory(enhancedInventory);
      return enhancedInventory;
    }

    // Save and return basic inventory
    await this.inventoryService.saveInventory(basicInventory);
    return basicInventory;
  }

  /**
   * Update inventory for specific files
   */
  private async updateInventory(targetFiles: string[]): Promise<ProjectInventory> {
    const result = await this.inventoryService.updateInventory(targetFiles);

    // If Claude Code is available and there are meaningful changes, enhance descriptions
    if (this.claudeCodeExecutor && (result.added.length > 0 || result.modified.length > 0)) {
      const filesToAnalyze = [...result.added, ...result.modified];
      const enhancedInventory = await this.enhanceFilesWithClaudeCode(
        result.inventory,
        filesToAnalyze
      );
      await this.inventoryService.saveInventory(enhancedInventory);
      return enhancedInventory;
    }

    await this.inventoryService.saveInventory(result.inventory);
    return result.inventory;
  }

  /**
   * Enhance inventory with Claude Code descriptions
   */
  private async enhanceWithClaudeCode(inventory: ProjectInventory): Promise<ProjectInventory> {
    const prompt = this.buildInventoryPrompt(inventory);

    try {
      const taskId = await this.claudeCodeExecutor!.execute({
        prompt,
        conversationContext: "",
        requirements:
          "Analyze the project structure and provide meaningful one-line descriptions for each file and directory.",
        phase: "chores",
      });

      logger.info("Claude Code analysis started", { taskId });

      // Wait for completion and parse results
      const enhancedInventory = await this.waitForClaudeCodeResults(inventory, taskId);
      return enhancedInventory;
    } catch (error) {
      logger.warn("Claude Code enhancement failed, using basic inventory", { error });
      return inventory;
    }
  }

  /**
   * Enhance specific files with Claude Code
   */
  private async enhanceFilesWithClaudeCode(
    inventory: ProjectInventory,
    filePaths: string[]
  ): Promise<ProjectInventory> {
    const prompt = this.buildPartialInventoryPrompt(inventory, filePaths);

    try {
      const taskId = await this.claudeCodeExecutor!.execute({
        prompt,
        conversationContext: "",
        requirements: `Analyze these ${filePaths.length} files and provide meaningful one-line descriptions.`,
        phase: "chores",
      });

      logger.info("Claude Code partial analysis started", { taskId, filesCount: filePaths.length });

      // Wait for completion and parse results
      const enhancedInventory = await this.waitForClaudeCodeResults(inventory, taskId);
      return enhancedInventory;
    } catch (error) {
      logger.warn("Claude Code enhancement failed for files", { error, filePaths });
      return inventory;
    }
  }

  /**
   * Build prompt for full inventory analysis
   */
  private buildInventoryPrompt(inventory: ProjectInventory): string {
    return `
# Project Inventory Analysis

You are analyzing a project to create a comprehensive inventory. Your task is to provide meaningful one-line descriptions for files and directories based on their names, locations, and context.

## Project Information
- Path: ${inventory.projectPath}
- Technologies: ${inventory.technologies.join(", ") || "Unknown"}
- Total Files: ${inventory.stats.totalFiles}
- Total Directories: ${inventory.stats.totalDirectories}

## Instructions
1. Analyze the file structure and provide a one-line description for each file
2. Focus on the PURPOSE and VALUE of each file, not just its type
3. For directories, describe what they contain or their role in the project
4. Be concise but informative - aim for 5-10 words per description
5. Consider the file's location and neighbors to understand its context

## File Structure
${this.formatFileStructureForPrompt(inventory)}

## Output Format
Return a JSON object with two properties:
- "fileDescriptions": { "path": "description", ... }
- "directoryDescriptions": { "path": "description", ... }

Focus on clarity and usefulness for developers who need to understand the codebase quickly.
`;
  }

  /**
   * Build prompt for partial inventory update
   */
  private buildPartialInventoryPrompt(inventory: ProjectInventory, filePaths: string[]): string {
    const relevantFiles = inventory.files.filter((f) => filePaths.includes(f.path));

    return `
# Partial Project Inventory Update

You are updating descriptions for specific files in an existing project inventory.

## Project Context
- Technologies: ${inventory.technologies.join(", ") || "Unknown"}
- Project Description: ${inventory.projectDescription}

## Files to Analyze
${relevantFiles.map((f) => `- ${f.path} (${f.type}, ${this.formatFileSize(f.size)})`).join("\n")}

## Instructions
1. Provide meaningful one-line descriptions for each file
2. Consider the file's purpose and role in the project
3. Be specific about what the file does or contains
4. Keep descriptions to 5-10 words

## Output Format
Return a JSON object:
{
  "fileDescriptions": {
    "path/to/file": "description",
    ...
  }
}
`;
  }

  /**
   * Format file structure for prompt
   */
  private formatFileStructureForPrompt(inventory: ProjectInventory): string {
    const lines: string[] = [];
    const tree = this.buildFileTree(inventory);
    this.formatTreeNode(tree, lines, "");
    return lines.join("\n");
  }

  /**
   * Build file tree structure
   */
  private buildFileTree(inventory: ProjectInventory): TreeNode {
    const root: TreeNode = { name: ".", children: new Map(), files: [] };

    // Add all files to tree
    for (const file of inventory.files) {
      const parts = file.path.split("/");
      let current = root;

      // Navigate/create directories
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current.children.has(part)) {
          current.children.set(part, { name: part, children: new Map(), files: [] });
        }
        current = current.children.get(part)!;
      }

      // Add file to current directory
      current.files.push({
        name: parts[parts.length - 1],
        type: file.type,
        size: file.size,
      });
    }

    return root;
  }

  /**
   * Format tree node for display
   */
  private formatTreeNode(node: TreeNode, lines: string[], indent: string): void {
    // Sort and display directories first
    const sortedDirs = Array.from(node.children.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [name, child] of sortedDirs) {
      lines.push(`${indent}${name}/`);
      this.formatTreeNode(child, lines, indent + "  ");
    }

    // Then files
    const sortedFiles = node.files.sort((a, b) => a.name.localeCompare(b.name));
    for (const file of sortedFiles) {
      lines.push(`${indent}${file.name} (${file.type})`);
    }
  }

  /**
   * Wait for Claude Code results
   */
  private async waitForClaudeCodeResults(
    inventory: ProjectInventory,
    taskId: string
  ): Promise<ProjectInventory> {
    // In a real implementation, we would monitor the task status
    // For now, return the inventory as-is
    // This would need integration with the event monitoring system

    logger.warn("Claude Code result monitoring not yet implemented", { taskId });
    return inventory;
  }

  /**
   * Format file size
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
}

interface TreeNode {
  name: string;
  children: Map<string, TreeNode>;
  files: Array<{
    name: string;
    type: string;
    size: number;
  }>;
}
