import { readFileTool } from "../tools/implementations/readFile";
import { shellTool } from "../tools/implementations/shell";
import { claudeCodeTool } from "../tools/implementations/claudeCode";
import { switchPhaseTool } from "../tools/implementations/switchPhase";
import { handoffTool } from "../tools/implementations/handoff";
import { analyze } from "../tools/implementations/analyze";
import { generateInventoryTool } from "../tools/implementations/generateInventory";
import { learnTool } from "../tools/implementations/learn";
import { Phase, PHASES } from "../conversations/phases";

/**
 * Default tools available to all agents (except PM-specific tools)
 * Note: learn tool is now phase-specific and only available during reflection phase
 */
export const DEFAULT_AGENT_TOOLS = [
    readFileTool.name,
    shellTool.name,
    claudeCodeTool.name,
    analyze.name,
];

/**
 * Tools that are only available to the Project Manager (PM) agent
 */
export const PM_ONLY_TOOLS = [switchPhaseTool.name, handoffTool.name, generateInventoryTool.name];

/**
 * Get the default tools for an agent based on their role and phase
 */
export function getDefaultToolsForAgent(isPMAgent: boolean, phase?: Phase): string[] {
    const baseTools = [readFileTool.name, shellTool.name, analyze.name];

    if (isPMAgent) {
        const pmTools = [
            ...baseTools,
            claudeCodeTool.name,
            switchPhaseTool.name,
            handoffTool.name,
            generateInventoryTool.name,
        ];

        // Add learn tool only during reflection phase
        if (phase === PHASES.REFLECTION) {
            pmTools.push(learnTool.name);
        }

        return pmTools;
    }

    // Non-PM agents get default tools
    const agentTools = [...DEFAULT_AGENT_TOOLS];
    
    // Add learn tool only during reflection phase
    if (phase === PHASES.REFLECTION) {
        agentTools.push(learnTool.name);
    }
    
    return agentTools;
}
