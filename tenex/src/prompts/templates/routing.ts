import type { AgentSummary } from "@/types/routing";
import { PromptBuilder } from "../core/PromptBuilder";

export interface RoutingPromptArgs {
  message?: string;
  currentPhase?: string;
  phaseHistory?: string;
  agents?: AgentSummary[];
  conversationSummary?: string;
}

export class RoutingPromptBuilder {
  static newConversation(args: RoutingPromptArgs): string {
    const builder = new PromptBuilder();

    return builder
      .add("base-context", {
        content: "You are a routing system for a development assistant platform.",
      })
      .add("task-description", {
        content:
          "Analyze this user message and determine the appropriate phase and initial approach.",
      })
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

  static phaseTransition(args: RoutingPromptArgs): string {
    const builder = new PromptBuilder();

    return builder
      .add("base-context", {
        content: "You are evaluating whether a conversation should transition to a new phase.",
      })
      .add("current-state", {
        content: `Current phase: ${args.currentPhase}
Conversation summary: ${args.conversationSummary}`,
      })
      .add("history", {
        content: `Recent activity:\n${args.phaseHistory}`,
      })
      .add("completion-criteria", {
        content: `Completion criteria:
- chat: Requirements are clear and documented
- plan: Architecture approved by relevant experts
- execute: Implementation complete and working
- review: Quality criteria met, tests passing`,
      })
      .add("task-description", {
        content: "Should we transition to a new phase?",
      })
      .add("json-response", {
        schema: `{
  "shouldTransition": true|false,
  "targetPhase": "chat|plan|execute|review",
  "reasoning": "brief explanation"
}`,
      })
      .build();
  }

  static selectAgent(args: RoutingPromptArgs): string {
    const builder = new PromptBuilder();

    return builder
      .add("base-context", {
        content: "Select the most appropriate agent for the current task.",
      })
      .add("current-state", {
        content: `Current phase: ${args.currentPhase}
Task context: ${args.message}`,
      })
      .add("agent-list", {
        agents: args.agents || [],
        format: "detailed",
      })
      .add("task-description", {
        content: "Select the agent best suited for this task based on their expertise.",
      })
      .add("json-response", {
        schema: `{
  "agentPubkey": "selected agent's pubkey",
  "reasoning": "why this agent is best suited"
}`,
      })
      .build();
  }

  static fallbackRouting(args: RoutingPromptArgs): string {
    const builder = new PromptBuilder();

    return builder
      .add("base-context", {
        content: "The primary routing failed. Analyze the conversation and determine next steps.",
      })
      .add("error-context", {
        content: `Message: ${args.message}
Current phase: ${args.currentPhase || "unknown"}`,
      })
      .add("task-description", {
        content: `Determine the appropriate action:
1. Which phase should handle this?
2. Should we ask the user for clarification?
3. Should we hand off to a specific agent?`,
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
}
