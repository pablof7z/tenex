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

        const agentList = availableForHandoff
            .map(agent => {
                const pmIndicator = agent.isPMAgent ? " (Project Manager)" : "";
                return `- **${agent.name}**${pmIndicator} (${agent.slug})\n  Role: ${agent.role}\n`;
            })
            .join("\n\n");

        return `## Available Agents
The following agents are available in this project for collaboration:

${agentList}

**Note**: You can consult these agents when their expertise aligns with part of the work you're doing.`;
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