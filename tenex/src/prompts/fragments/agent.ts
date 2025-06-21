import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

interface AgentFragmentArgs {
  agent: {
    name: string;
    instructions: string;
    role?: string;
  };
  project?: {
    name: string;
    description?: string;
  };
}

export const agentFragment: PromptFragment<AgentFragmentArgs> = {
  id: "agent-base",
  priority: 10,
  template: ({ agent, project }) => {
    let prompt = `You are ${agent.name}`;

    if (agent.role) {
      prompt += `, ${agent.role}`;
    }

    prompt += `\n\n${agent.instructions}`;

    if (project) {
      prompt += `\n\nWorking on project: ${project.name}`;
    }

    return prompt;
  },
};

// Agent core fragment - basic agent identity
export const agentCoreFragment: PromptFragment<Record<string, never>> = {
  id: "agentCore",
  priority: 5,
  template: () => `You are an AI agent that helps users with tasks.
You should be helpful, accurate, and follow instructions carefully.`,
};

// Agent profile fragment
interface AgentProfileArgs {
  profile: {
    name: string;
    role: string;
    description: string;
    capabilities?: string[];
  };
}

export const agentProfileFragment: PromptFragment<AgentProfileArgs> = {
  id: "agentProfile",
  priority: 15,
  template: ({ profile }) => {
    let prompt = `Your identity:
- Name: ${profile.name}
- Role: ${profile.role}
- Description: ${profile.description}`;

    if (profile.capabilities && profile.capabilities.length > 0) {
      prompt += `\n- Capabilities: ${profile.capabilities.join(", ")}`;
    }

    return prompt;
  },
};

// Auto-register
fragmentRegistry.register(agentFragment);
fragmentRegistry.register(agentCoreFragment);
fragmentRegistry.register(agentProfileFragment);
