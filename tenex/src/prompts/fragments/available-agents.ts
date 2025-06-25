import type { Agent } from "@/agents/types";
import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

// Available agents fragment - shows all agents available in the project
interface AvailableAgentsArgs {
    agents: Agent[];
    currentAgentPubkey?: string; // To exclude current agent from handoff options
}

export const availableAgentsFragment: PromptFragment<AvailableAgentsArgs> = {
    id: "available-agents",
    priority: 15,
    template: ({ agents, currentAgentPubkey }) => {
        if (agents.length === 0) {
            return "## Available Agents\nNo agents are currently available.";
        }

        // Filter out current agent if specified
        const availableForHandoff = currentAgentPubkey 
            ? agents.filter(agent => agent.pubkey !== currentAgentPubkey)
            : agents;

        if (availableForHandoff.length === 0) {
            return "## Available Agents\nNo other agents are available.";
        }

        // Find current agent to determine if PM
        const currentAgent = currentAgentPubkey 
            ? agents.find(agent => agent.pubkey === currentAgentPubkey)
            : null;
        const isCurrentAgentPM = currentAgent?.isPMAgent || false;

        const agentList = availableForHandoff
            .map(agent => {
                const pmIndicator = agent.isPMAgent ? " (Project Manager)" : "";
                return `- **${agent.name}**${pmIndicator} (${agent.slug})\n  Role: ${agent.role}\n`;
            })
            .join("\n\n");

        // Provide different guidance based on agent type
        const guidance = isCurrentAgentPM 
            ? `**As Project Manager**: When tasks fall within a specialist's area of expertise, delegate to them using the handoff tool. Let specialists handle implementation details within their domain.`
            : `**As a Specialist**: Focus on your area of expertise. If you receive feedback or tasks that fall outside your specialization, defer to other specialists or the PM agent rather than attempting to handle them yourself.`;

        return `## Available Agents
The following agents are available in this project:

${agentList}

${guidance}`;
    },
    validateArgs: (args): args is AvailableAgentsArgs => {
        return (
            typeof args === "object" &&
            args !== null &&
            Array.isArray((args as AvailableAgentsArgs).agents)
        );
    },
};

// Register the fragment
fragmentRegistry.register(availableAgentsFragment);