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
}

// Helper function to load inventory and context synchronously
function loadProjectContextSync(phase: Phase): { inventoryContent: string | null, contextFiles: string[] } {
    let inventoryContent: string | null = null;
    let contextFiles: string[] = [];
    
    // Load inventory content for chat and brainstorm phases
    if (phase === "chat" || phase === "brainstorm") {
        try {
            const inventoryPath = path.join(process.cwd(), ".tenex", "inventory.md");
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
            contextFiles = files.filter(f => f.endsWith(".md"));
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
    template: ({ phase }) => {
        const { inventoryContent, contextFiles } = loadProjectContextSync(phase);
        const parts: string[] = [];

        parts.push(`<project_inventory>
The project inventory provides comprehensive information about this codebase:
`);
        
        // Only show inventory for chat phase
        if (phase === "chat" || phase === "brainstorm") {
            if (inventoryContent) {
                parts.push(`${inventoryContent}

This inventory helps you understand the project structure, significant files, and architectural patterns when working with the codebase.

This is just a map for you to be quickly situated.
`);
            } else {
                parts.push(`## Project Context
No project inventory is available yet. An inventory can be generated to provide detailed information about the project structure, files, and dependencies.`);
            }
        }
        
        // Add context files listing if available
        if (contextFiles && contextFiles.length > 0) {
            parts.push(`### Additional Context Files
The following documentation files are available in the context/ directory and can be read using the read_file tool:
${contextFiles.map(f => `- context/${f}`).join('\n')}`);
        }

        parts.push("</project_inventory>\n");
        
        return parts.join('\n\n');
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
    phase: Phase;
    previousPhase?: Phase;
    claudeCodeReport?: string;
}

export const claudeCodeReportFragment: PromptFragment<ClaudeCodeReportArgs> = {
    id: "claude-code-report",
    priority: 30,
    template: ({ phase, previousPhase, claudeCodeReport }) => {
        const parts = [];
        
        // If we have a Claude Code report from direct invocation
        if (claudeCodeReport && (phase === 'plan' || phase === 'execute')) {
            parts.push(`
## Claude Code Report

Claude Code has completed the following work:

${claudeCodeReport}

Your role now is to:
1. Review the work completed
2. Identify any gaps or issues
3. Coordinate with other agents as needed
4. Determine next steps
`);
        }
        
        // Add phase transition instructions if we have previousPhase
        if (previousPhase && previousPhase !== phase) {
            parts.push(getPhaseTransitionInstructions(previousPhase, phase));
        }
        
        return parts.join('\n\n');
    },
    validateArgs: (args): args is ClaudeCodeReportArgs => {
        return (
            typeof args === "object" &&
            args !== null &&
            typeof (args as ClaudeCodeReportArgs).phase === "string"
        );
    },
};

// Register fragments
fragmentRegistry.register(inventoryContextFragment);
fragmentRegistry.register(claudeCodeReportFragment);