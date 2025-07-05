import * as fs from "node:fs";
import * as path from "node:path";
import type { Phase } from "@/conversations/phases";
import { logger } from "@/utils/logger";
import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";
import { getPhaseTransitionInstructions } from "./phase";

// Project inventory context fragment
interface InventoryContextArgs {
  phase: Phase;
  inventoryContent?: string; // Optional to support both old and new usage
  isProjectManager?: boolean; // Whether this is the project-manager agent
}

// Helper function to get project files (excluding dot files/dirs)
function getProjectFiles(): { files: string[]; isEmpty: boolean; tree: string } {
  const projectFiles: string[] = [];
  let isEmpty = true;

  // Helper function to build tree structure recursively
  function buildTree(dir: string, prefix = "", isLast = true): string[] {
    const treeLines: string[] = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      // Filter and sort entries
      const filteredEntries = entries.filter((entry) => {
        // Skip dot files/dirs and node_modules
        return !entry.name.startsWith(".") && entry.name !== "node_modules";
      });

      // Sort directories first, then files
      filteredEntries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      filteredEntries.forEach((entry, index) => {
        const isLastEntry = index === filteredEntries.length - 1;
        const connector = isLastEntry ? "└── " : "├── ";
        const extension = isLastEntry ? "    " : "│   ";

        if (entry.isDirectory()) {
          treeLines.push(`${prefix}${connector}${entry.name}/`);
          // Recursively process subdirectory
          const subDir = path.join(dir, entry.name);
          const subTree = buildTree(subDir, prefix + extension, isLastEntry);
          treeLines.push(...subTree);
        } else {
          treeLines.push(`${prefix}${connector}${entry.name}`);
        }
      });
    } catch (error) {
      logger.debug(`Could not read directory ${dir}`, { error });
    }

    return treeLines;
  }

  try {
    const projectDir = process.cwd();
    const entries = fs.readdirSync(projectDir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip dot files/dirs and node_modules
      if (entry.name.startsWith(".") || entry.name === "node_modules") {
        continue;
      }

      isEmpty = false;

      if (entry.isDirectory()) {
        projectFiles.push(`${entry.name}/`);
      } else {
        projectFiles.push(entry.name);
      }
    }

    // Sort directories first, then files
    projectFiles.sort((a, b) => {
      const aIsDir = a.endsWith("/");
      const bIsDir = b.endsWith("/");
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.localeCompare(b);
    });
  } catch (error) {
    logger.debug("Could not read project directory", { error });
  }

  // Build the tree structure
  const treeLines = buildTree(process.cwd());
  const tree = treeLines.join("\n");

  return { files: projectFiles, isEmpty, tree };
}

// Helper function to load inventory and context synchronously
function loadProjectContextSync(
  phase: Phase,
  isProjectManager: boolean
): {
  inventoryContent: string | null;
  projectContent: string | null;
  contextFiles: string[];
} {
  let inventoryContent: string | null = null;
  let projectContent: string | null = null;
  let contextFiles: string[] = [];

  // Load inventory content for chat and brainstorm phases
  if (phase === "chat" || phase === "brainstorm") {
    try {
      const inventoryPath = path.join(process.cwd(), "context", "INVENTORY.md");
      if (fs.existsSync(inventoryPath)) {
        inventoryContent = fs.readFileSync(inventoryPath, "utf8");
      }
    } catch (error) {
      logger.debug("Could not load inventory content", { error });
    }
  }

  // Load PROJECT.md content only for project-manager
  if (isProjectManager) {
    try {
      const projectPath = path.join(process.cwd(), "context", "PROJECT.md");
      if (fs.existsSync(projectPath)) {
        projectContent = fs.readFileSync(projectPath, "utf8");
      }
    } catch (error) {
      logger.debug("Could not load project content", { error });
    }
  }

  // Get list of context files
  try {
    const contextDir = path.join(process.cwd(), "context");
    if (fs.existsSync(contextDir)) {
      const files = fs.readdirSync(contextDir);
      contextFiles = files.filter(
        (f) => f.endsWith(".md") && f !== "INVENTORY.md" && f !== "PROJECT.md"
      );
    }
  } catch (error) {
    // Context directory may not exist
    logger.debug("Could not read context directory", { error });
  }

  return { inventoryContent, projectContent, contextFiles };
}

export const inventoryContextFragment: PromptFragment<InventoryContextArgs> = {
  id: "project-inventory-context",
  priority: 25,
  template: (args) => {
    const { phase, inventoryContent: providedContent, isProjectManager = false } = args;

    // If content is provided directly, use it; otherwise load from file
    let inventoryContent: string | null = providedContent || null;
    let projectContent: string | null = null;
    let contextFiles: string[] = [];

    if (!providedContent) {
      const loaded = loadProjectContextSync(phase, isProjectManager);
      inventoryContent = loaded.inventoryContent;
      projectContent = loaded.projectContent;
      contextFiles = loaded.contextFiles;
    }

    const parts: string[] = [];

    parts.push(`<project_inventory>
The project inventory provides comprehensive information about this codebase:
`);

    if (inventoryContent) {
      parts.push(`${inventoryContent}

This inventory helps you understand the project structure, significant files, and architectural patterns when working with the codebase.

This is just a map for you to be quickly situated.
`);
    } else {
      // Get project files to determine if this is a fresh project
      const { isEmpty, tree } = getProjectFiles();

      if (isEmpty) {
        parts.push(`## Project Context
This is a fresh project with no files yet.`);
      } else {
        parts.push(`## Project Context

\`\`\`
${tree}
\`\`\`
`);
      }
    }

    // Add context files listing if available
    if (contextFiles && contextFiles.length > 0) {
      parts.push(`### Additional Context Files
The following documentation files are available in the context/ directory and can be read using the read_file tool:
${contextFiles.map((f) => `- context/${f}`).join("\n")}`);
    }

    // For non-project-manager agents, just mention PROJECT.md exists
    if (!isProjectManager) {
      const projectPath = path.join(process.cwd(), "context", "PROJECT.md");
      if (fs.existsSync(projectPath)) {
        parts.push(`### Project Understanding Document
The project-manager maintains a comprehensive understanding of the project in context/PROJECT.md.
This document contains the user's vision, requirements, and project evolution history.`);
      }
    }

    parts.push("</project_inventory>\n");

    // Add PROJECT.md content only for project-manager
    if (isProjectManager && projectContent) {
      parts.push(`<project_understanding>
## Current Project Understanding

This is your comprehensive understanding of what the user is building:

${projectContent}

${phase === "reflection" ? "During this reflection phase, you MUST update this document to include all new information learned from the current session." : ""}
</project_understanding>\n`);
    }

    return parts.join("\n\n");
  },
  validateArgs: (args): args is InventoryContextArgs => {
    return (
      typeof args === "object" &&
      args !== null &&
      typeof (args as InventoryContextArgs).phase === "string"
    );
  },
};

// Claude Code report processing fragment for PM agents
interface ClaudeCodeReportArgs {
  claudeCodeReport?: string;
}

export const claudeCodeReportFragment: PromptFragment<ClaudeCodeReportArgs> = {
  id: "claude-code-report",
  priority: 30,
  template: ({ claudeCodeReport }) => {
    if (!claudeCodeReport) {
      return "";
    }

    return `
## Claude Code Report

Claude Code has completed the following work:

${claudeCodeReport}

Your role now is to:
1. Review the work completed
2. Identify any gaps or issues
3. Coordinate with other agents as needed
4. Determine next steps
`;
  },
  validateArgs: (args): args is ClaudeCodeReportArgs => {
    return typeof args === "object" && args !== null;
  },
};

// Register fragments
fragmentRegistry.register(inventoryContextFragment);
fragmentRegistry.register(claudeCodeReportFragment);
