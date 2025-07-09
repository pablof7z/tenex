import type { Agent } from "@/agents/types";
import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

// Available agents fragment - shows all agents available in the project
interface AvailableAgentsArgs {
  agents: Agent[];
  currentAgent?: Agent;
  currentAgentPubkey?: string;
}

export const availableAgentsFragment: PromptFragment<AvailableAgentsArgs> = {
  id: "available-agents",
  priority: 15,
  template: ({ agents, currentAgent, currentAgentPubkey }) => {
    if (agents.length === 0) {
      return "## Available Agents\nNo agents are currently available.";
    }

    // Filter out current agent if specified
    const currentPubkey = currentAgent?.pubkey || currentAgentPubkey;
    const availableForHandoff = currentPubkey 
      ? agents.filter((agent) => agent.pubkey !== currentPubkey)
      : agents;

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

    // Determine if current agent is an orchestrator
    const currentAgentObj = currentAgent || (currentAgentPubkey ? agents.find(a => a.pubkey === currentAgentPubkey) : null);
    const isCurrentAgentOrchestrator = currentAgentObj?.isOrchestrator || false;

    const preface = isCurrentAgentOrchestrator
      ? "The agents available to you in this system to involve in the workflow are:"
      : "You are part of a multi-agent system, here are your coworkers:";
    
    // Add role-specific guidance
    const roleGuidance = isCurrentAgentOrchestrator 
      ? `

As Orchestrator:
- You coordinate work between specialist agents
- Don't implement solutions yourself - delegate to them using the continue tool
- Focus on routing, not solving technical problems
- Let specialists handle implementation details` 
      : `

As a Specialist:
- Focus on your area of expertise
- When you need help outside your domain, defer to other specialists or the orchestrator agent
- Use the complete tool when you finish your work or need to hand off to another agent`;

    return `## Available Agents
${preface}

${agentList}${roleGuidance}`;
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
