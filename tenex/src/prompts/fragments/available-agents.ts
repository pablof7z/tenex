import type { Agent } from "@/agents/types";
import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

// Available agents fragment - shows all agents available in the project for handoffs
interface AvailableAgentsArgs {
    agents: Agent[];
    currentAgentPubkey?: string; // To exclude current agent from handoff options
}

export const availableAgentsFragment: PromptFragment<AvailableAgentsArgs> = {
    id: "available-agents",
    priority: 15,
    template: ({ agents, currentAgentPubkey }) => {
        if (agents.length === 0) {
            return "## Available Agents\nNo agents are currently available for handoffs.";
        }

        // Filter out current agent if specified
        const availableForHandoff = currentAgentPubkey 
            ? agents.filter(agent => agent.pubkey !== currentAgentPubkey)
            : agents;

        if (availableForHandoff.length === 0) {
            return "## Available Agents\nNo other agents are available for handoffs.";
        }

        const agentList = availableForHandoff
            .map(agent => {
                const pmIndicator = agent.isPMAgent ? " (PM)" : "";
                return `- **${agent.name}**${pmIndicator} (${agent.slug})\n  Role: ${agent.role}\n  Pubkey: ${agent.pubkey}`;
            })
            .join("\n\n");

        return `## Available Agents
The following agents are available in this project for collaboration and handoffs:

${agentList}

**Note**: You can hand off tasks to these agents when their expertise is better suited for the current work.`;
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