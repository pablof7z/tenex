/**
 * Default tools available to all agents (except PM-specific tools)
 */
export const DEFAULT_AGENT_TOOLS = ["file", "shell", "claude_code"];

/**
 * Tools that are only available to the Project Manager (PM) agent
 */
export const PM_ONLY_TOOLS = ["next_action", "get_current_requirements"];

/**
 * Get the default tools for an agent based on their role and phase
 */
export function getDefaultToolsForAgent(isPMAgent: boolean, phase?: string): string[] {
    const baseTools = ['file', 'shell'];
    
    if (isPMAgent) {
        const pmTools = [...baseTools, 'next_action'];
        
        // Add claude_code tool for plan and execute phases (explicit for clarity)
        if (phase === 'plan' || phase === 'execute') {
            pmTools.push('claude_code');
        }
        
        // Add requirements tool only for chat phase
        if (phase === 'chat') {
            pmTools.push('get_current_requirements');
        }
        
        return pmTools;
    }
    
    // Non-PM agents get default tools
    return [...DEFAULT_AGENT_TOOLS];
}
