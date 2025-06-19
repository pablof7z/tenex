/**
 * Agent catalog template for available project agents
 */
import type { AgentSummary } from "@/agents/core/types";

export const AGENT_CATALOG_PROMPT = (agents: AgentSummary[], currentAgentName: string) => {
    if (!agents || agents.length === 0) {
        return "";
    }

    // Filter out the current agent from the list
    const otherAgents = agents.filter((agent) => agent.name !== currentAgentName);

    if (otherAgents.length === 0) {
        return "";
    }

    const agentList = otherAgents
        .map((agent) => `- **${agent.name}**: ${agent.role} - ${agent.description}`)
        .join("\n");

    return `

AVAILABLE TEAM AGENTS:
${agentList}

You can request help from any of these agents by using the "blocked" signal and specifying which agents you need and why.`;
};
