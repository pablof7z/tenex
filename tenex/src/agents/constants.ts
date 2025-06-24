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
    const tools = [...DEFAULT_AGENT_TOOLS];

    if (isPMAgent) {
        // PM always gets next_action
        tools.push("next_action");

        // PM only gets get_current_requirements in chat phase
        if (phase === "chat") {
            tools.push("get_current_requirements");
        }
    }

    return tools;
}
