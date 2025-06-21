import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@tenex/shared";
import { configurationService } from "@tenex/shared/services";
import type { ProjectConfig } from "@tenex/types/config";
import type {
  DirectoryInventoryItem,
  FileInventoryItem,
  InventoryConfig,
  InventoryDiff,
  InventoryUpdateResult,
  ProjectInventory,
} from "@tenex/types/inventory";

const DEFAULT_INVENTORY_PATH = "context/INVENTORY.md";
const INVENTORY_VERSION = "1.0.0";

const DEFAULT_EXCLUDE_PATTERNS = [
  "node_modules",
  ".git",
  ".tenex",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".cache",
  "*.log",
  "*.lock",
  ".DS_Store",
  "tmp",
  "temp",
];

export class InventoryService {
  private projectPath: string;
  private config: InventoryConfig;

  constructor(projectPath: string, config?: InventoryConfig) {
    this.projectPath = projectPath;
    this.config = {
      inventoryPath: DEFAULT_INVENTORY_PATH,
      exclude: DEFAULT_EXCLUDE_PATTERNS,
      maxFileSize: 1024 * 1024, // 1MB default
      analyzeExports: true,
      ...config,
    };
  }

  /**
   * Generate a complete inventory of the project
   */
  async generateInventory(): Promise<ProjectInventory> {
    logger.info("Generating project inventory", { projectPath: this.projectPath });

    const startTime = Date.now();
    const files: FileInventoryItem[] = [];
    const directories: DirectoryInventoryItem[] = [];
    const fileTypes: Record<string, number> = {};

    // Load project config to get description
    const projectConfig = await this.loadProjectConfig();

    // Recursively scan the project
    await this.scanDirectory("", files, directories, fileTypes);

    // Detect technologies
    const technologies = this.detectTechnologies(files);

    const inventory: ProjectInventory = {
      projectPath: this.projectPath,
      generatedAt: Date.now(),
      version: INVENTORY_VERSION,
      projectDescription: projectConfig?.description || "No description available",
      technologies,
      files,
      directories,
      stats: {
        totalFiles: files.length,
        totalDirectories: directories.length,
        totalSize: files.reduce((sum, file) => sum + file.size, 0),
        fileTypes,
      },
    };

    const duration = Date.now() - startTime;
    logger.info("Project inventory generated", {
      filesCount: files.length,
      directoriesCount: directories.length,
      duration,
    });

    return inventory;
  }

  /**
   * Update inventory for specific changed files
   */
  async updateInventory(changedFiles: string[]): Promise<InventoryUpdateResult> {
    const existingInventory = await this.loadInventory();
    if (!existingInventory) {
      // No existing inventory, generate a new one
      const inventory = await this.generateInventory();
      return {
        added: inventory.files.map((f) => f.path),
        modified: [],
        removed: [],
        inventory,
      };
    }

    const added: string[] = [];
    const modified: string[] = [];
    const removed: string[] = [];

    // Create a map for quick lookup
    const fileMap = new Map(existingInventory.files.map((f) => [f.path, f]));

    // Process changed files
    for (const filePath of changedFiles) {
      // Normalize the path - if it's absolute, make it relative; if relative, keep it
      const normalizedPath = path.isAbsolute(filePath) 
        ? path.relative(this.projectPath, filePath)
        : filePath;

      try {
        const stats = await fs.stat(path.join(this.projectPath, normalizedPath));

        if (stats.isFile()) {
          const fileItem = await this.createFileInventoryItem(normalizedPath, stats);

          if (fileMap.has(normalizedPath)) {
            // File was modified
            modified.push(normalizedPath);
            const index = existingInventory.files.findIndex((f) => f.path === normalizedPath);
            if (index !== -1) {
              existingInventory.files[index] = fileItem;
            }
          } else {
            // File was added
            added.push(normalizedPath);
            existingInventory.files.push(fileItem);
          }
        }
      } catch (error) {
        // File was removed
        if (fileMap.has(normalizedPath)) {
          removed.push(normalizedPath);
          existingInventory.files = existingInventory.files.filter(
            (f) => f.path !== normalizedPath
          );
        }
      }
    }

    // Update stats
    existingInventory.generatedAt = Date.now();
    existingInventory.stats.totalFiles = existingInventory.files.length;
    existingInventory.stats.totalSize = existingInventory.files.reduce(
      (sum, file) => sum + file.size,
      0
    );

    // Recalculate file types
    existingInventory.stats.fileTypes = {};
    for (const file of existingInventory.files) {
      existingInventory.stats.fileTypes[file.type] =
        (existingInventory.stats.fileTypes[file.type] || 0) + 1;
    }

    return {
      added,
      modified,
      removed,
      inventory: existingInventory,
    };
  }

  /**
   * Load existing inventory from file
   */
  async loadInventory(): Promise<ProjectInventory | null> {
    try {
      const inventoryPath = await this.getInventoryPath();
      const content = await fs.readFile(inventoryPath, "utf-8");

      // Parse markdown format back to JSON
      const inventory = this.parseMarkdownInventory(content);
      return inventory;
    } catch (error) {
      logger.debug("No existing inventory found", { error });
      return null;
    }
  }

  /**
   * Save inventory to file
   */
  async saveInventory(inventory: ProjectInventory): Promise<void> {
    const inventoryPath = await this.getInventoryPath();
    const markdown = this.formatInventoryAsMarkdown(inventory);

    // Ensure directory exists
    const dir = path.dirname(inventoryPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(inventoryPath, markdown, "utf-8");
    logger.info("Inventory saved", { path: inventoryPath });
  }

  /**
   * Get diff between two inventories
   */
  getDiff(oldInventory: ProjectInventory, newInventory: ProjectInventory): InventoryDiff {
    const oldFileMap = new Map(oldInventory.files.map((f) => [f.path, f]));
    const newFileMap = new Map(newInventory.files.map((f) => [f.path, f]));
    const oldDirMap = new Map(oldInventory.directories.map((d) => [d.path, d]));
    const newDirMap = new Map(newInventory.directories.map((d) => [d.path, d]));

    const added: FileInventoryItem[] = [];
    const modified: FileInventoryItem[] = [];
    const removed: string[] = [];
    const directoriesAdded: DirectoryInventoryItem[] = [];
    const directoriesRemoved: string[] = [];

    // Find added and modified files
    for (const [path, file] of newFileMap) {
      if (!oldFileMap.has(path)) {
        added.push(file);
      } else {
        const oldFile = oldFileMap.get(path)!;
        if (oldFile.lastModified !== file.lastModified || oldFile.size !== file.size) {
          modified.push(file);
        }
      }
    }

    // Find removed files
    for (const [path] of oldFileMap) {
      if (!newFileMap.has(path)) {
        removed.push(path);
      }
    }

    // Find added directories
    for (const [path, dir] of newDirMap) {
      if (!oldDirMap.has(path)) {
        directoriesAdded.push(dir);
      }
    }

    // Find removed directories
    for (const [path] of oldDirMap) {
      if (!newDirMap.has(path)) {
        directoriesRemoved.push(path);
      }
    }

    return {
      added,
      modified,
      removed,
      directoriesAdded,
      directoriesRemoved,
    };
  }

  /**
   * Get the inventory file path
   */
  private async getInventoryPath(): Promise<string> {
    const projectConfig = await this.loadProjectConfig();
    const inventoryPath =
      projectConfig?.paths?.inventory || this.config.inventoryPath || DEFAULT_INVENTORY_PATH;
    return path.join(this.projectPath, ".tenex", inventoryPath);
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
   * Recursively scan a directory
   */
  private async scanDirectory(
    relativePath: string,
    files: FileInventoryItem[],
    directories: DirectoryInventoryItem[],
    fileTypes: Record<string, number>
  ): Promise<void> {
    const fullPath = path.join(this.projectPath, relativePath);

    // Check if this path should be excluded
    if (this.shouldExclude(relativePath)) {
      return;
    }

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const subdirs: string[] = [];
      let fileCount = 0;

      for (const entry of entries) {
        const entryPath = relativePath ? path.join(relativePath, entry.name) : entry.name;

        if (this.shouldExclude(entryPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          subdirs.push(entry.name);
          await this.scanDirectory(entryPath, files, directories, fileTypes);
        } else if (entry.isFile()) {
          const stats = await fs.stat(path.join(fullPath, entry.name));
          const fileItem = await this.createFileInventoryItem(entryPath, stats);
          files.push(fileItem);
          fileCount++;

          // Update file type stats
          fileTypes[fileItem.type] = (fileTypes[fileItem.type] || 0) + 1;
        }
      }

      // Add directory info if it has files or subdirectories
      if (relativePath && (fileCount > 0 || subdirs.length > 0)) {
        directories.push({
          path: relativePath,
          description: `Directory containing ${fileCount} files`,
          fileCount,
          subdirectories: subdirs,
        });
      }
    } catch (error) {
      logger.warn("Failed to scan directory", { path: fullPath, error });
    }
  }

  /**
   * Create inventory item for a file
   */
  private async createFileInventoryItem(
    relativePath: string,
    stats: fs.Stats
  ): Promise<FileInventoryItem> {
    const ext = path.extname(relativePath).toLowerCase();
    const type = ext || "no-extension";

    return {
      path: relativePath,
      type,
      description: `${type} file`,
      size: stats.size,
      lastModified: stats.mtimeMs,
      tags: this.getFileTags(relativePath),
    };
  }

  /**
   * Check if a path should be excluded
   */
  private shouldExclude(relativePath: string): boolean {
    if (!relativePath) return false;

    return (
      this.config.exclude?.some((pattern) => {
        if (pattern.includes("*")) {
          // Simple glob matching
          const regex = new RegExp(pattern.replace(/\*/g, ".*"));
          return regex.test(relativePath);
        }
        return relativePath.includes(pattern);
      }) || false
    );
  }

  /**
   * Get tags for a file based on its path and name
   */
  private getFileTags(filePath: string): string[] {
    const tags: string[] = [];
    const lower = filePath.toLowerCase();

    if (lower.includes("test") || lower.includes("spec")) tags.push("test");
    if (lower.includes("service")) tags.push("service");
    if (lower.includes("component")) tags.push("component");
    if (lower.includes("util") || lower.includes("helper")) tags.push("utility");
    if (lower.includes("config")) tags.push("configuration");
    if (lower.includes("type") || lower.includes("interface")) tags.push("types");
    if (lower.includes("schema")) tags.push("schema");
    if (lower.includes("route") || lower.includes("controller")) tags.push("api");

    return tags;
  }

  /**
   * Detect technologies used in the project
   */
  private detectTechnologies(files: FileInventoryItem[]): string[] {
    const technologies = new Set<string>();
    const fileNames = files.map((f) => f.path);

    // Package managers and configs
    if (fileNames.some((f) => f === "package.json")) technologies.add("Node.js");
    if (fileNames.some((f) => f === "cargo.toml")) technologies.add("Rust");
    if (fileNames.some((f) => f === "go.mod")) technologies.add("Go");
    if (fileNames.some((f) => f === "requirements.txt" || f === "setup.py"))
      technologies.add("Python");

    // Frameworks
    if (fileNames.some((f) => f === "next.config.js" || f === "next.config.ts"))
      technologies.add("Next.js");
    if (fileNames.some((f) => f.includes("react"))) technologies.add("React");
    if (fileNames.some((f) => f.includes("vue"))) technologies.add("Vue");
    if (fileNames.some((f) => f.includes("angular"))) technologies.add("Angular");

    // Build tools
    if (fileNames.some((f) => f === "tsconfig.json")) technologies.add("TypeScript");
    if (fileNames.some((f) => f === "vite.config.ts" || f === "vite.config.js"))
      technologies.add("Vite");
    if (fileNames.some((f) => f === "webpack.config.js")) technologies.add("Webpack");
    if (fileNames.some((f) => f === "bun.lockb")) technologies.add("Bun");

    // Testing
    if (fileNames.some((f) => f === "jest.config.js" || f === "jest.config.ts"))
      technologies.add("Jest");
    if (fileNames.some((f) => f === "vitest.config.ts")) technologies.add("Vitest");

    return Array.from(technologies);
  }

  /**
   * Format inventory as markdown
   */
  private formatInventoryAsMarkdown(inventory: ProjectInventory): string {
    const lines: string[] = [
      "# Project Inventory",
      "",
      `Generated: ${new Date(inventory.generatedAt).toISOString()}`,
      `Version: ${inventory.version}`,
      "",
      "## Project Overview",
      "",
      `**Description:** ${inventory.projectDescription}`,
      `**Technologies:** ${inventory.technologies.join(", ") || "None detected"}`,
      "",
      "## Statistics",
      "",
      `- Total Files: ${inventory.stats.totalFiles}`,
      `- Total Directories: ${inventory.stats.totalDirectories}`,
      `- Total Size: ${this.formatBytes(inventory.stats.totalSize)}`,
      "",
      "### File Types",
      "",
    ];

    // Add file type breakdown
    for (const [type, count] of Object.entries(inventory.stats.fileTypes).sort(
      (a, b) => b[1] - a[1]
    )) {
      lines.push(`- ${type}: ${count} files`);
    }

    lines.push("", "## Directory Structure", "");

    // Add directories
    const dirsByDepth = this.organizeDirsByDepth(inventory.directories);
    for (const [depth, dirs] of dirsByDepth) {
      for (const dir of dirs.sort((a, b) => a.path.localeCompare(b.path))) {
        const indent = "  ".repeat(depth);
        lines.push(`${indent}- **${dir.path}/** - ${dir.description}`);
      }
    }

    lines.push("", "## Files", "");

    // Group files by directory
    const filesByDir = this.groupFilesByDirectory(inventory.files);
    for (const [dir, files] of filesByDir) {
      lines.push(`### ${dir || "Root"}`);
      lines.push("");

      for (const file of files.sort((a, b) => a.path.localeCompare(b.path))) {
        const tags = file.tags?.length ? ` [${file.tags.join(", ")}]` : "";
        lines.push(`- **${path.basename(file.path)}** - ${file.description}${tags}`);
      }
      lines.push("");
    }

    // Add metadata as JSON comment for parsing
    lines.push("<!--");
    lines.push("INVENTORY_DATA:");
    lines.push(JSON.stringify(inventory, null, 2));
    lines.push("-->");

    return lines.join("\n");
  }

  /**
   * Parse markdown inventory back to JSON
   */
  private parseMarkdownInventory(markdown: string): ProjectInventory | null {
    try {
      // Extract JSON from comment
      const match = markdown.match(/<!--\s*INVENTORY_DATA:\s*([\s\S]*?)\s*-->/);
      if (match && match[1]) {
        return JSON.parse(match[1]);
      }
      return null;
    } catch (error) {
      logger.error("Failed to parse inventory markdown", { error });
      return null;
    }
  }

  /**
   * Organize directories by depth
   */
  private organizeDirsByDepth(
    directories: DirectoryInventoryItem[]
  ): Map<number, DirectoryInventoryItem[]> {
    const map = new Map<number, DirectoryInventoryItem[]>();

    for (const dir of directories) {
      const depth = dir.path.split(path.sep).length - 1;
      if (!map.has(depth)) {
        map.set(depth, []);
      }
      map.get(depth)!.push(dir);
    }

    return map;
  }

  /**
   * Group files by directory
   */
  private groupFilesByDirectory(files: FileInventoryItem[]): Map<string, FileInventoryItem[]> {
    const map = new Map<string, FileInventoryItem[]>();

    for (const file of files) {
      const dir = path.dirname(file.path);
      const key = dir === "." ? "" : dir;

      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(file);
    }

    return map;
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}
