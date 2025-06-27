import { readFileTool } from "../tools/implementations/readFile";
import { shellTool } from "../tools/implementations/shell";
import { claudeCodeTool } from "../tools/implementations/claudeCode";
import { analyze } from "../tools/implementations/analyze";
import { generateInventoryTool } from "../tools/implementations/generateInventory";
import { learnTool } from "../tools/implementations/learn";

/**
 * Default tools available to all agents (except PM-specific tools)
 */
export const DEFAULT_AGENT_TOOLS = [
    readFileTool.name,
    shellTool.name,
    claudeCodeTool.name,
    analyze.name,
    learnTool.name,
];

/**
 * Tools that are only available to the Project Manager (PM) agent
 */
export const PM_ONLY_TOOLS = ["continue", generateInventoryTool.name];

/**
 * Get the default tools for an agent based on their role and phase
 */
export function getDefaultToolsForAgent(isPMAgent: boolean, phase?: string): string[] {
    if (isPMAgent) {
        return [
            readFileTool.name,
            analyze.name,
            "continue",  // replaces switchPhase + handoff
            generateInventoryTool.name,
            learnTool.name,
            "complete"
        ];
    }

    // Non-PM agents get default tools
    return [...DEFAULT_AGENT_TOOLS];
}
