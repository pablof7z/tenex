import { readFileTool } from '../tools/implementations/readFile';
import { shellTool } from '../tools/implementations/shell';
import { claudeCodeTool } from '../tools/implementations/claudeCode';
import { switchPhaseTool } from '../tools/implementations/switchPhase';
import { handoffTool } from '../tools/implementations/handoff';

/**
 * Default tools available to all agents (except PM-specific tools)
 */
export const DEFAULT_AGENT_TOOLS = [
    readFileTool.name,
    shellTool.name,
    claudeCodeTool.name
];

/**
 * Tools that are only available to the Project Manager (PM) agent
 */
export const PM_ONLY_TOOLS = [
    switchPhaseTool.name,
    handoffTool.name
];

/**
 * Get the default tools for an agent based on their role and phase
 */
export function getDefaultToolsForAgent(isPMAgent: boolean, phase?: string): string[] {
    const baseTools = [
        readFileTool.name,
        shellTool.name
    ];
    
    if (isPMAgent) {
        const pmTools = [...baseTools, switchPhaseTool.name, handoffTool.name];
        
        // Add claude_code tool for plan and execute phases (explicit for clarity)
        if (phase === 'plan' || phase === 'execute') {
            pmTools.push(claudeCodeTool.name);
        }
        
        
        return pmTools;
    }
    
    // Non-PM agents get default tools
    return [...DEFAULT_AGENT_TOOLS];
}
