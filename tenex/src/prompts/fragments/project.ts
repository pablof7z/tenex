import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";
import { getPhaseTransitionInstructions } from "./phase";
import type { Phase } from "@/conversations/phases";
import { inventoryExists, loadInventoryContent } from "@/utils/inventory";

// Project inventory context fragment
interface InventoryContextArgs {
    phase: Phase;
    projectPath: string;
    contextFiles?: string[];
}

export const inventoryContextFragment: PromptFragment<InventoryContextArgs> = {
    id: "project-inventory-context",
    priority: 25,
    template: ({ hasInventory, inventoryContent, contextFiles }) => {
        const parts: string[] = [];
        
        if (hasInventory && inventoryContent) {
            parts.push(`## Project Context

The project inventory provides comprehensive information about this codebase:

${inventoryContent}

This inventory helps you understand the project structure, significant files, and architectural patterns when working with the codebase.`);
        } else if (hasInventory) {
            parts.push(`## Project Context
A project inventory exists but could not be loaded. The inventory contains detailed information about the project structure, files, and dependencies that can help you understand the codebase better.`);
        } else {
            parts.push(`## Project Context
No project inventory is available yet. An inventory can be generated to provide detailed information about the project structure, files, and dependencies.`);
        }
        
        // Add context files listing if available
        if (contextFiles && contextFiles.length > 0) {
            parts.push(`### Additional Context Files
The following documentation files are available in the context/ directory and can be read using the read_file tool:
${contextFiles.map(f => `- context/${f}`).join('\n')}`);
        }
        
        return parts.join('\n\n');
    },
    validateArgs: (args): args is InventoryContextArgs => {
        return (
            typeof args === "object" &&
            args !== null &&
            typeof (args as InventoryContextArgs).hasInventory === "boolean"
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