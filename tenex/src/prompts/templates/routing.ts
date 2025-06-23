import type { AgentSummary } from "@/routing/types";
import { PromptBuilder } from "../core/PromptBuilder";
import "../fragments/routing-prompts"; // Ensure fragments are registered
import "../fragments/project"; // Ensure project fragments are registered

export interface RoutingPromptArgs {
    message?: string;
    currentPhase?: string;
    phaseHistory?: string;
    agents?: AgentSummary[];
    conversationSummary?: string;
    projectContext?: string;
    projectInventory?: string;
    projectName?: string;
    projectDescription?: string;
    projectRepository?: string;
    projectTags?: string[];
}

export function buildNewConversationRoutingPrompt(args: RoutingPromptArgs): string {
    const builder = new PromptBuilder();

    return builder
        .add("routing-base-context", {
            content: "You are a routing system for a development assistant platform.",
        })
        .add(
            "project-information",
            {
                name: args.projectName || "Unknown Project",
                description: args.projectDescription,
                repository: args.projectRepository,
                tags: args.projectTags,
                hasInventory: !!args.projectInventory,
            },
            (projArgs) => !!projArgs.name
        )
        .add("task-description", {
            content:
                "Analyze this user message and determine the appropriate phase and initial approach.",
        })
        .add(
            "enriched-project-context",
            {
                projectContext: args.projectContext,
                projectInventory: args.projectInventory,
            },
            (ctxArgs) => !!(ctxArgs.projectContext || ctxArgs.projectInventory)
        )
        .add("phase-descriptions", {})
        .add("agent-list", {
            agents: args.agents || [],
            format: "simple",
        })
        .add("new-conversation-routing", {
            message: args.message || "",
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
        .add("routing-base-context", {
            content: "You are evaluating whether a conversation should transition to a new phase.",
        })
        .add("task-description", {
            content:
                "Analyze the conversation state and determine if a phase transition is needed.",
        })
        .add("phase-descriptions", {})
        .add("phase-transition-context", {
            currentPhase: args.currentPhase,
            phaseHistory: args.phaseHistory,
            conversationSummary: args.conversationSummary,
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

    return builder
        .add("routing-base-context", {
            content: "You are selecting the best agent for the current task.",
        })
        .add(
            "project-information",
            {
                name: args.projectName || "Unknown Project",
                description: args.projectDescription,
                repository: args.projectRepository,
                tags: args.projectTags,
                hasInventory: !!args.projectInventory,
            },
            (projArgs) => !!projArgs.name
        )
        .add("task-description", {
            content:
                "Choose the most appropriate agent based on the conversation context and requirements.",
        })
        .add(
            "enriched-project-context",
            {
                projectContext: args.projectContext,
                projectInventory: args.projectInventory,
            },
            (ctxArgs) => !!(ctxArgs.projectContext || ctxArgs.projectInventory)
        )
        .add("agent-list", {
            agents: args.agents || [],
            format: "detailed",
        })
        .add("agent-selection-context", {
            currentPhase: args.currentPhase,
            message: args.message,
            conversationSummary: args.conversationSummary,
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

    return builder
        .add("routing-base-context", {
            content:
                "You are performing fallback routing when the primary system couldn't make a decision.",
        })
        .add(
            "project-information",
            {
                name: args.projectName || "Unknown Project",
                description: args.projectDescription,
                repository: args.projectRepository,
                tags: args.projectTags,
                hasInventory: !!args.projectInventory,
            },
            (projArgs) => !!projArgs.name
        )
        .add("task-description", {
            content: "Make the best possible routing decision with limited information.",
        })
        .add(
            "enriched-project-context",
            {
                projectContext: args.projectContext,
                projectInventory: args.projectInventory,
            },
            (ctxArgs) => !!(ctxArgs.projectContext || ctxArgs.projectInventory)
        )
        .add("phase-descriptions", {})
        .add("agent-list", {
            agents: args.agents || [],
            format: "simple",
        })
        .add("new-conversation-routing", {
            message: args.message || "",
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

export const RoutingPromptBuilder = {
    newConversation: buildNewConversationRoutingPrompt,
    phaseTransition: buildPhaseTransitionRoutingPrompt,
    selectAgent: buildSelectAgentRoutingPrompt,
    fallback: buildFallbackRoutingPrompt,
};
