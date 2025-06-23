import type { AgentSummary } from "@/routing/types";
import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

// Agent list fragment - reusable across all prompts that need to show agents
interface AgentListArgs {
  agents: AgentSummary[];
  format?: "simple" | "detailed";
}

export const agentListFragment: PromptFragment<AgentListArgs> = {
  id: "agent-list",
  priority: 50,
  template: ({ agents, format = "simple" }) => {
    if (agents.length === 0) {
      return "No agents available.";
    }

    const header = "Available agents:";

    if (format === "simple") {
      const list = agents.map((a) => `- ${a.name} (${a.role})`).join("\n");
      return `${header}\n${list}`;
    }
    const list = agents
      .map(
        (a) => `- ${a.name} (pubkey: ${a.pubkey})\n  Role: ${a.role}`
      )
      .join("\n\n");
    return `${header}\n${list}`;
  },
};

// Tool list fragment - for showing available tools
interface ToolListArgs {
  tools: Array<{ name: string; description: string }>;
}

export const toolListFragment: PromptFragment<ToolListArgs> = {
  id: "tool-list",
  priority: 60,
  template: ({ tools }) => {
    if (tools.length === 0) {
      return "No tools available.";
    }

    const header = "Available tools:";
    const list = tools.map((t) => `- ${t.name}: ${t.description}`).join("\n");

    return `${header}\n${list}`;
  },
};

// Phase descriptions fragment
export const phaseDescriptionsFragment: PromptFragment<Record<string, never>> = {
  id: "phase-descriptions",
  priority: 40,
  template: () => `Phases:
- chat: User needs clarification, discussion, or requirements gathering
- plan: User has clear requirements ready for architectural planning
- execute: User has specific implementation task or approved plan to implement
- review: User needs validation, testing, or review of existing work`,
};

// JSON response format fragment
interface JSONFormatArgs {
  schema: string;
  example?: string;
}

export const jsonResponseFragment: PromptFragment<JSONFormatArgs> = {
  id: "json-response",
  priority: 90,
  template: ({ schema, example }) => {
    let prompt = `Respond with JSON only:\n${schema}`;
    if (example) {
      prompt += `\n\nExample:\n${example}`;
    }
    return prompt;
  },
};

// Next action instructions
interface NextActionArgs {
  availableActions: string[];
}

export const nextActionFragment: PromptFragment<NextActionArgs> = {
  id: "next-action",
  priority: 70,
  template: ({
    availableActions,
  }) => `After completing your response, you must specify the next action:
${availableActions.map((a) => `- ${a}`).join("\n")}

Include this in your response as a "nextAction" field.`,
};

// Debug mode instructions fragment
export const debugInstructionsFragment: PromptFragment<Record<string, never>> = {
  id: "debugInstructions",
  priority: 80,
  template: () => `You are in debug mode. This is a special mode for testing and development.
You can interact naturally and help with debugging tasks.
Be helpful and informative about the system's behavior.
When asked about implementation details, provide clear explanations.`,
};

// Register all fragments
fragmentRegistry.register(agentListFragment);
fragmentRegistry.register(toolListFragment);
fragmentRegistry.register(phaseDescriptionsFragment);
fragmentRegistry.register(jsonResponseFragment);
fragmentRegistry.register(nextActionFragment);
fragmentRegistry.register(debugInstructionsFragment);
