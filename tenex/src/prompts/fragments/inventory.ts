import { InventoryService } from "@/services/InventoryService";
import { logger } from "@tenex/shared";
import type { ProjectInventory } from "@tenex/types/inventory";
import type { PromptFragment } from "../core/types";

export interface InventoryFragmentArgs {
  projectPath: string;
  includeFullStructure?: boolean;
  maxFiles?: number;
}

export const inventoryFragment: PromptFragment<InventoryFragmentArgs> = {
  id: "project-inventory",
  priority: 18, // After project context, before conversation

  validate: (args) => {
    if (!args.projectPath) {
      throw new Error("Project path is required for inventory fragment");
    }
  },

  template: async ({ projectPath, includeFullStructure = false, maxFiles = 100 }) => {
    try {
      // Load inventory
      const inventoryService = new InventoryService(projectPath);
      const inventory = await inventoryService.loadInventory();

      if (!inventory) {
        logger.debug("No inventory found for project", { projectPath });
        return "";
      }

      return formatInventoryPrompt(inventory, includeFullStructure, maxFiles);
    } catch (error) {
      logger.warn("Failed to load inventory for prompt", { error, projectPath });
      return "";
    }
  },
};

/**
 * Format inventory into a concise prompt section
 */
function formatInventoryPrompt(
  inventory: ProjectInventory,
  includeFullStructure: boolean,
  maxFiles: number
): string {
  const lines: string[] = [
    "## Project Inventory",
    "",
    `**Technologies:** ${inventory.technologies.join(", ") || "Not specified"}`,
    `**Total Files:** ${inventory.stats.totalFiles}`,
    `**Total Directories:** ${inventory.stats.totalDirectories}`,
    "",
  ];

  // Add file type summary
  lines.push("**File Types:**");
  const topFileTypes = Object.entries(inventory.stats.fileTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [type, count] of topFileTypes) {
    lines.push(`- ${type}: ${count} files`);
  }
  lines.push("");

  // Add directory structure summary
  if (inventory.directories.length > 0) {
    lines.push("**Key Directories:**");
    const topLevelDirs = inventory.directories
      .filter((d) => !d.path.includes("/"))
      .sort((a, b) => b.fileCount - a.fileCount)
      .slice(0, 15);

    for (const dir of topLevelDirs) {
      lines.push(`- **${dir.path}/** - ${dir.description}`);
    }
    lines.push("");
  }

  // Add important files
  if (includeFullStructure) {
    lines.push("**Project Structure:**");
    lines.push("```");
    lines.push(buildFileTree(inventory, maxFiles));
    lines.push("```");
    lines.push("");
  } else {
    // Just show key files
    lines.push("**Key Files:**");
    const keyFiles = getKeyFiles(inventory).slice(0, 20);

    for (const file of keyFiles) {
      const tags = file.tags?.length ? ` [${file.tags.join(", ")}]` : "";
      lines.push(`- **${file.path}** - ${file.description}${tags}`);
    }
    lines.push("");
  }

  lines.push(
    "*Note: This is an automated project inventory. Use this information to understand the project structure and locate relevant files.*"
  );
  lines.push("");

  return lines.join("\n");
}

/**
 * Get key files from inventory
 */
function getKeyFiles(inventory: ProjectInventory): typeof inventory.files {
  // Prioritize certain types of files
  const priorityPatterns = [
    /^(package\.json|cargo\.toml|go\.mod|requirements\.txt)$/,
    /^(README|readme)\.(md|txt)?$/,
    /config\.(ts|js|json)$/,
    /^src\/index\.(ts|js)$/,
    /^(app|main|index)\.(ts|js)$/,
    /schema\.(ts|graphql|prisma)$/,
    /routes?\.(ts|js)$/,
  ];

  const keyFiles: typeof inventory.files = [];
  const otherFiles: typeof inventory.files = [];

  for (const file of inventory.files) {
    const basename = file.path.split("/").pop() || "";
    const isPriority = priorityPatterns.some((pattern) => pattern.test(basename));

    if (isPriority) {
      keyFiles.push(file);
    } else if (file.tags?.includes("configuration") || file.tags?.includes("api")) {
      otherFiles.push(file);
    }
  }

  return [...keyFiles, ...otherFiles];
}

/**
 * Build a text file tree
 */
function buildFileTree(inventory: ProjectInventory, maxFiles: number): string {
  const lines: string[] = [];
  const tree = buildTreeStructure(inventory);
  formatTreeNode(tree, lines, "", maxFiles);

  if (inventory.files.length > maxFiles) {
    lines.push(`... and ${inventory.files.length - maxFiles} more files`);
  }

  return lines.join("\n");
}

interface TreeNode {
  name: string;
  children: Map<string, TreeNode>;
  files: string[];
}

function buildTreeStructure(inventory: ProjectInventory): TreeNode {
  const root: TreeNode = { name: ".", children: new Map(), files: [] };

  for (const file of inventory.files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current.children.has(part)) {
        current.children.set(part, { name: part, children: new Map(), files: [] });
      }
      current = current.children.get(part)!;
    }

    current.files.push(parts[parts.length - 1]);
  }

  return root;
}

function formatTreeNode(
  node: TreeNode,
  lines: string[],
  indent: string,
  remainingFiles: number
): number {
  let filesShown = 0;

  // Show directories first
  const sortedDirs = Array.from(node.children.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [name, child] of sortedDirs) {
    if (filesShown >= remainingFiles) break;
    lines.push(`${indent}${name}/`);
    filesShown += formatTreeNode(child, lines, indent + "  ", remainingFiles - filesShown);
  }

  // Then files
  const filesToShow = Math.min(node.files.length, remainingFiles - filesShown);
  const sortedFiles = node.files.sort().slice(0, filesToShow);
  for (const file of sortedFiles) {
    lines.push(`${indent}${file}`);
    filesShown++;
  }

  if (node.files.length > filesToShow) {
    lines.push(`${indent}... and ${node.files.length - filesToShow} more files`);
  }

  return filesShown;
}
