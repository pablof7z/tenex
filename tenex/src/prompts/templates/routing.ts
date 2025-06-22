import type { AgentSummary } from "@/routing/types";
import { PromptBuilder } from "../core/PromptBuilder";

export interface RoutingPromptArgs {
  message?: string;
  currentPhase?: string;
  phaseHistory?: string;
  agents?: AgentSummary[];
  conversationSummary?: string;
  projectContext?: string;
  projectInventory?: string;
}

export function buildNewConversationRoutingPrompt(args: RoutingPromptArgs): string {
  const builder = new PromptBuilder();

  let promptBuilder = builder
    .add("base-context", {
      content: "You are a routing system for a development assistant platform.",
    })
    .add("task-description", {
      content:
        "Analyze this user message and determine the appropriate phase and initial approach.",
    });

  if (args.projectContext || args.projectInventory) {
    const enrichedContext = formatEnrichedProjectContext(
      args.projectContext,
      args.projectInventory
    );
    promptBuilder = promptBuilder.add("base-context", {
      content: enrichedContext,
    });
  }

  return promptBuilder
    .add("phase-descriptions", {})
    .add("agent-list", {
      agents: args.agents || [],
      format: "simple",
    })
    .add("user-context", {
      content: `User message: "${args.message}"`,
    })
    .add("json-response", {
      schema: `{
  "phase": "chat|plan|execute|review",
  "reasoning": "brief explanation of why this phase",
  "confidence": 0.0-1.0
}`,
    })
    .build();
}

export function buildPhaseTransitionRoutingPrompt(args: RoutingPromptArgs): string {
  const builder = new PromptBuilder();

  return builder
    .add("base-context", {
      content: "You are evaluating whether a conversation should transition to a new phase.",
    })
    .add("task-description", {
      content: "Analyze the conversation state and determine if a phase transition is needed.",
    })
    .add("phase-descriptions", {})
    .add("user-context", {
      content: `Current phase: ${args.currentPhase}
Phase history: ${args.phaseHistory}
Conversation summary: ${args.conversationSummary}`,
    })
    .add("json-response", {
      schema: `{
  "shouldTransition": true|false,
  "targetPhase": "chat|plan|execute|review|chores" (if transition needed),
  "reasoning": "explanation",
  "confidence": 0.0-1.0,
  "conditions": ["list of conditions that need to be met"]
}`,
    })
    .build();
}

export function buildSelectAgentRoutingPrompt(args: RoutingPromptArgs): string {
  const builder = new PromptBuilder();

  let promptBuilder = builder
    .add("base-context", {
      content: "You are selecting the best agent for the current task.",
    })
    .add("task-description", {
      content:
        "Choose the most appropriate agent based on the conversation context and requirements.",
    });

  if (args.projectContext || args.projectInventory) {
    const enrichedContext = formatEnrichedProjectContext(
      args.projectContext,
      args.projectInventory
    );
    promptBuilder = promptBuilder.add("base-context", {
      content: enrichedContext,
    });
  }

  return promptBuilder
    .add("agent-list", {
      agents: args.agents || [],
      format: "detailed",
    })
    .add("user-context", {
      content: `Current phase: ${args.currentPhase}
Message: "${args.message}"
Conversation summary: ${args.conversationSummary}`,
    })
    .add("json-response", {
      schema: `{
  "agent": "agent name or pubkey",
  "reasoning": "why this agent is best suited",
  "confidence": 0.0-1.0,
  "alternatives": ["list of alternative agents in order of preference"]
}`,
    })
    .build();
}

export function buildFallbackRoutingPrompt(args: RoutingPromptArgs): string {
  const builder = new PromptBuilder();

  let promptBuilder = builder
    .add("base-context", {
      content:
        "You are performing fallback routing when the primary system couldn't make a decision.",
    })
    .add("task-description", {
      content: "Make the best possible routing decision with limited information.",
    });

  if (args.projectContext || args.projectInventory) {
    const enrichedContext = formatEnrichedProjectContext(
      args.projectContext,
      args.projectInventory
    );
    promptBuilder = promptBuilder.add("base-context", {
      content: enrichedContext,
    });
  }

  return promptBuilder
    .add("phase-descriptions", {})
    .add("agent-list", {
      agents: args.agents || [],
      format: "simple",
    })
    .add("user-context", {
      content: `User message: "${args.message}"`,
    })
    .add("json-response", {
      schema: `{
  "action": "set_phase|ask_user|handoff",
  "phase": "chat|plan|execute|review" (if action is set_phase),
  "message": "message to user" (if action is ask_user),
  "agentPubkey": "agent pubkey" (if action is handoff),
  "reasoning": "explanation"
}`,
    })
    .build();
}

function formatEnrichedProjectContext(basicContext?: string, inventory?: string): string {
  const sections: string[] = [];

  sections.push("## Project Context\n");

  if (inventory) {
    // Include the inventory markdown content
    sections.push("### Project Inventory");
    sections.push(inventory);
    sections.push("");
  } else if (basicContext) {
    // Fallback to basic context
    sections.push(basicContext);
  }

  return sections.join("\n");
}

export const RoutingPromptBuilder = {
  newConversation: buildNewConversationRoutingPrompt,
  phaseTransition: buildPhaseTransitionRoutingPrompt,
  selectAgent: buildSelectAgentRoutingPrompt,
  fallback: buildFallbackRoutingPrompt,
};
