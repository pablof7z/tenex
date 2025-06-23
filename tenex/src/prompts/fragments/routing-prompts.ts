import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

// Fragment for enriched project context in routing
interface ProjectContextArgs {
    projectContext?: string;
    projectInventory?: string;
}

export const enrichedProjectContextFragment: PromptFragment<ProjectContextArgs> = {
    id: "enriched-project-context",
    priority: 20,
    template: ({ projectContext, projectInventory }) => {
        const sections: string[] = [];

        if (projectInventory) {
            sections.push(projectInventory);
        } else if (projectContext) {
            // Only include if no inventory is available
            sections.push("## Project Structure (0 files)");
            sections.push("");
            sections.push("### File Types:");
            sections.push("");
            sections.push("### Directory Structure:");
            sections.push("");
            sections.push(
                "*Note: This project appears to be empty or has no analyzed structure yet.*"
            );
        }

        return sections.join("\n");
    },
    validateArgs: (args): args is ProjectContextArgs => {
        return typeof args === "object" && args !== null;
    },
};

// Fragment for routing base context
interface RoutingBaseContextArgs {
    content: string;
}

export const routingBaseContextFragment: PromptFragment<RoutingBaseContextArgs> = {
    id: "routing-base-context",
    priority: 10,
    template: ({ content }) => content,
    validateArgs: (args): args is RoutingBaseContextArgs => {
        return (
            typeof args === "object" && args !== null && typeof (args as any).content === "string"
        );
    },
};

// Fragment for new conversation routing
export const newConversationRoutingFragment: PromptFragment<{ message: string }> = {
    id: "new-conversation-routing",
    priority: 30,
    template: ({ message }) => `User message: "${message}"`,
    validateArgs: (args): args is { message: string } => {
        return (
            typeof args === "object" && args !== null && typeof (args as any).message === "string"
        );
    },
};

// Fragment for phase transition context
interface PhaseTransitionContextArgs {
    currentPhase?: string;
    phaseHistory?: string;
    conversationSummary?: string;
}

export const phaseTransitionContextFragment: PromptFragment<PhaseTransitionContextArgs> = {
    id: "phase-transition-context",
    priority: 30,
    template: ({ currentPhase, phaseHistory, conversationSummary }) => {
        const parts: string[] = [];

        if (currentPhase) parts.push(`Current phase: ${currentPhase}`);
        if (phaseHistory) parts.push(`Phase history: ${phaseHistory}`);
        if (conversationSummary) parts.push(`Conversation summary: ${conversationSummary}`);

        return parts.join("\n");
    },
    validateArgs: (args): args is PhaseTransitionContextArgs => {
        return typeof args === "object" && args !== null;
    },
};

// Fragment for agent selection context
interface AgentSelectionContextArgs {
    currentPhase?: string;
    message?: string;
    conversationSummary?: string;
}

export const agentSelectionContextFragment: PromptFragment<AgentSelectionContextArgs> = {
    id: "agent-selection-context",
    priority: 30,
    template: ({ currentPhase, message, conversationSummary }) => {
        const parts: string[] = [];

        if (currentPhase) parts.push(`Current phase: ${currentPhase}`);
        if (message) parts.push(`Message: "${message}"`);
        if (conversationSummary) parts.push(`Conversation summary: ${conversationSummary}`);

        return parts.join("\n");
    },
    validateArgs: (args): args is AgentSelectionContextArgs => {
        return typeof args === "object" && args !== null;
    },
};

// Fragment for phase transition response schema
export const phaseTransitionResponseFragment: PromptFragment<Record<string, never>> = {
    id: "phase-transition-response",
    priority: 80,
    template: () => `{
  "shouldTransition": true|false,
  "targetPhase": "chat|plan|execute|review|chores" (if transition needed),
  "reasoning": "explanation",
  "confidence": 0.0-1.0,
  "conditions": ["list of conditions that need to be met"]
}`,
};

// Fragment for agent selection response schema
export const agentSelectionResponseFragment: PromptFragment<Record<string, never>> = {
    id: "agent-selection-response",
    priority: 80,
    template: () => `{
  "agent": "agent name or pubkey",
  "reasoning": "why this agent is best suited",
  "confidence": 0.0-1.0,
  "alternatives": ["list of alternative agents in order of preference"]
}`,
};

// Fragment for fallback routing response schema
export const fallbackRoutingResponseFragment: PromptFragment<Record<string, never>> = {
    id: "fallback-routing-response",
    priority: 80,
    template: () => `{
  "action": "set_phase|ask_user|handoff",
  "phase": "chat|plan|execute|review" (if action is set_phase),
  "message": "message to user" (if action is ask_user),
  "agentPubkey": "agent pubkey" (if action is handoff),
  "reasoning": "explanation"
}`,
};

// Register all fragments
fragmentRegistry.register(enrichedProjectContextFragment);
fragmentRegistry.register(routingBaseContextFragment);
fragmentRegistry.register(newConversationRoutingFragment);
fragmentRegistry.register(phaseTransitionContextFragment);
fragmentRegistry.register(agentSelectionContextFragment);
fragmentRegistry.register(phaseTransitionResponseFragment);
fragmentRegistry.register(agentSelectionResponseFragment);
fragmentRegistry.register(fallbackRoutingResponseFragment);
