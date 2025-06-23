/**
 * Default tools available to all agents (except PM-specific tools)
 */
export const DEFAULT_AGENT_TOOLS = ["file", "shell", "claude_code"];

/**
 * Tools that are only available to the Project Manager (boss) agent
 */
export const PM_ONLY_TOOLS = ["phase_transition", "get_current_requirements"];

/**
 * Get the default tools for an agent based on their role and phase
 */
export function getDefaultToolsForAgent(isBoss: boolean, phase?: string): string[] {
  const tools = [...DEFAULT_AGENT_TOOLS];
  
  if (isBoss) {
    // PM always gets phase_transition
    tools.push("phase_transition");
    
    // PM only gets get_current_requirements in chat phase
    if (phase === "chat") {
      tools.push("get_current_requirements");
    }
  }
  
  return tools;
}