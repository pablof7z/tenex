import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

interface RoutingSystemFragmentArgs {
  role?: string;
  projectContext?: string;
}

/**
 * System prompt for the routing LLM
 */
export const routingSystemPrompt: PromptFragment<RoutingSystemFragmentArgs> = {
  id: "routing-system-prompt",
  priority: 10,
  template: ({ role = "conversation routing", projectContext }) => {
    return `You are a routing system that determines conversation phases and assigns appropriate agents.

Your role is to analyze conversations and make intelligent ${role} decisions based on:
- The current conversation state and phase
- Available agent capabilities and expertise
- User intent and requirements
- Project context and goals

${projectContext ? `\n## Project Context\n\n${projectContext}\n` : ""}

You must ensure smooth transitions between phases and appropriate agent assignments. Use the project structure and file information above to make more informed routing decisions about which agents would be most suitable for specific tasks.`;
  },
};

/**
 * Phase transition system prompt
 */
export const phaseTransitionSystemPrompt: PromptFragment<Record<string, never>> = {
  id: "phase-transition-system",
  priority: 10,
  template: () => {
    return `You are evaluating whether a conversation should transition to a new phase.

You must consider:
- Whether the current phase objectives have been met
- If the conversation naturally leads to the next phase
- Whether prerequisites for the next phase are satisfied
- The user's explicit or implicit intent

Be conservative with transitions - only recommend a change when clearly warranted.`;
  },
};

/**
 * Agent selection system prompt
 */
export const agentSelectionSystemPrompt: PromptFragment<Record<string, never>> = {
  id: "agent-selection-system",
  priority: 10,
  template: () => {
    return `You are selecting the most appropriate agent for a specific task.

Consider:
- Agent expertise and specialization
- Current phase requirements
- Task complexity and domain
- Previous agent performance in similar contexts

Select agents based on the best match between task requirements and agent capabilities.`;
  },
};

/**
 * Fallback routing system prompt
 */
export const fallbackRoutingSystemPrompt: PromptFragment<Record<string, never>> = {
  id: "fallback-routing-system",
  priority: 10,
  template: () => {
    return `You are handling a routing decision where the primary routing mechanism has failed.

Your goal is to:
- Analyze why the initial routing might have failed
- Determine the most appropriate recovery action
- Ensure the conversation continues smoothly
- Provide clear reasoning for your decision

Be pragmatic and focus on keeping the conversation productive.`;
  },
};

// Auto-register all fragments
fragmentRegistry.register(routingSystemPrompt);
fragmentRegistry.register(phaseTransitionSystemPrompt);
fragmentRegistry.register(agentSelectionSystemPrompt);
fragmentRegistry.register(fallbackRoutingSystemPrompt);
