import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";
import { getPhaseTransitionInstructions } from "./phase";
import type { Phase } from "@/conversations/phases";
import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "@/utils/logger";

// Project inventory context fragment
interface InventoryContextArgs {
    phase: Phase;
    inventoryContent?: string; // Optional to support both old and new usage
}

// Helper function to get project files (excluding dot files/dirs)
function getProjectFiles(): { files: string[]; isEmpty: boolean } {
    const projectFiles: string[] = [];
    let isEmpty = true;

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

    return { files: projectFiles, isEmpty };
}

// Helper function to load inventory and context synchronously
function loadProjectContextSync(phase: Phase): {
    inventoryContent: string | null;
    contextFiles: string[];
} {
    let inventoryContent: string | null = null;
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

    // Get list of context files
    try {
        const contextDir = path.join(process.cwd(), "context");
        if (fs.existsSync(contextDir)) {
            const files = fs.readdirSync(contextDir);
            contextFiles = files.filter((f) => f.endsWith(".md"));
        }
    } catch (error) {
        // Context directory may not exist
        logger.debug("Could not read context directory", { error });
    }

    return { inventoryContent, contextFiles };
}

export const inventoryContextFragment: PromptFragment<InventoryContextArgs> = {
    id: "project-inventory-context",
    priority: 25,
    template: (args) => {
        const { phase, inventoryContent: providedContent } = args;
        
        // If content is provided directly, use it; otherwise load from file
        let inventoryContent: string | null = providedContent || null;
        let contextFiles: string[] = [];
        
        if (!providedContent) {
            const loaded = loadProjectContextSync(phase);
            inventoryContent = loaded.inventoryContent;
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
            const { files: projectFiles, isEmpty } = getProjectFiles();
            
            if (isEmpty) {
                parts.push(`## Project Context
This is a fresh project with no files yet.`);
            } else {
                parts.push(`## Project Context
No project inventory is available yet. You should suggest to the user to create one as it will greatly improve your understanding of the codebase.

### Current Project Structure
Here are the files and directories in the project root:
${projectFiles.map(f => `- ${f}`).join("\n")}

Generating an inventory will provide a comprehensive overview of the project's architecture, significant files, and patterns.`);
            }
        }

        // Add context files listing if available
        if (contextFiles && contextFiles.length > 0) {
            parts.push(`### Additional Context Files
The following documentation files are available in the context/ directory and can be read using the read_file tool:
${contextFiles.map((f) => `- context/${f}`).join("\n")}`);
        }

        parts.push("</project_inventory>\n");

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
        return (
            typeof args === "object" &&
            args !== null
        );
    },
};

// Register fragments
fragmentRegistry.register(inventoryContextFragment);
fragmentRegistry.register(claudeCodeReportFragment);
