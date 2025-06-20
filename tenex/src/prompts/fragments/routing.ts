import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

interface RoutingFragmentArgs {
  availableAgents?: string[];
}

export const routingFragment: PromptFragment<RoutingFragmentArgs> = {
  id: "routing-llm",
  priority: 5,
  template: ({ availableAgents = [] }) => {
    let prompt =
      "You are a routing LLM. Your job is to analyze requests and route them to the appropriate agent.";

    if (availableAgents.length > 0) {
      prompt += `\n\nAvailable agents to route to:\n${availableAgents.map((a) => `- ${a}`).join("\n")}`;
    }

    return prompt;
  },
};

// Auto-register
fragmentRegistry.register(routingFragment);
