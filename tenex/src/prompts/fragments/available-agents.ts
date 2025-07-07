import type { Agent } from "@/agents/types";
import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

// Available agents fragment - shows all agents available in the project
interface AvailableAgentsArgs {
  agents: Agent[];
  currentAgent: Agent;
}

export const availableAgentsFragment: PromptFragment<AvailableAgentsArgs> = {
  id: "available-agents",
  priority: 15,
  template: ({ agents, currentAgent }) => {
    if (agents.length === 0) {
      return "## Available Agents\nNo agents are currently available.";
    }

    // Filter out current agent if specified
    const availableForHandoff = agents.filter((agent) => agent.pubkey !== currentAgent.pubkey)

    if (availableForHandoff.length === 0) {
      return "## Available Agents\nNo other agents are available.";
    }

    const agentList = availableForHandoff
      .map((agent) => {
        const orchestratorIndicator = agent.isOrchestrator ? " (Orchestrator)" : "";
        let agentInfo = `- **${agent.name}**${orchestratorIndicator} (${agent.slug})\n  Role: ${agent.role}`;
        if (agent.useCriteria) {
          agentInfo += `\n  Use Criteria: ${agent.useCriteria}`;
        } else if (agent.description) {
          agentInfo += `\n  Description: ${agent.description}`;
        }
        return `${agentInfo}\n`;
      })
      .join("\n\n");

    return `## Available Agents
The following agents are available in this project:

${agentList}`;
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
