import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

// Fragment for conversation context in phases
interface ConversationContextArgs {
    title: string;
    summary?: string;
    branch?: string;
}

export const phaseConversationContextFragment: PromptFragment<ConversationContextArgs> = {
    id: "phase-conversation-context",
    priority: 20,
    template: ({ title, summary, branch }) => {
        const parts: string[] = [`Conversation: ${title}`];

        if (summary) {
            parts.push(`Current understanding: ${summary}`);
        } else {
            parts.push("Current understanding: Just started");
        }

        if (branch) {
            parts.push(`Branch: ${branch}`);
        }

        return parts.join("\n");
    },
    validateArgs: (args): args is ConversationContextArgs => {
        return typeof args === "object" && args !== null && typeof (args as ConversationContextArgs).title === "string";
    },
};

// Fragment for chat phase guidelines
export const chatPhaseGuidelinesFragment: PromptFragment<Record<string, never>> = {
    id: "chat-phase-guidelines",
    priority: 30,
    template: () => `Your goal is to:
1. Quickly understand what the user wants
2. Only ask clarifying questions if the request is genuinely ambiguous
3. If the request is clear, immediately transition to the appropriate phase
4. Focus on action over unnecessary conversation`,
};

// Fragment for plan phase task
interface PlanPhaseTaskArgs {
    requirements: string;
}

export const planPhaseTaskFragment: PromptFragment<PlanPhaseTaskArgs> = {
    id: "plan-phase-task",
    priority: 30,
    template: ({ requirements }) => `Requirements:
${requirements}

Create a comprehensive plan that includes:
1. Architecture overview
2. Technology choices with justification
3. Implementation phases
4. Key components and their interactions
5. Testing strategy
6. Potential challenges and mitigations`,
    validateArgs: (args): args is PlanPhaseTaskArgs => {
        return (
            typeof args === "object" &&
            args !== null &&
            typeof (args as PlanPhaseTaskArgs).requirements === "string"
        );
    },
};

// Fragment for execute phase task
interface ExecutePhaseTaskArgs {
    plan: string;
}

export const executePhaseTaskFragment: PromptFragment<ExecutePhaseTaskArgs> = {
    id: "execute-phase-task",
    priority: 30,
    template: ({ plan }) => `Approved plan:
${plan}

Implement the plan following these guidelines:
1. Follow the approved architecture
2. Write clean, maintainable code
3. Include appropriate tests
4. Document complex logic
5. Commit changes with clear messages`,
    validateArgs: (args): args is ExecutePhaseTaskArgs => {
        return typeof args === "object" && args !== null && typeof (args as ExecutePhaseTaskArgs).plan === "string";
    },
};

// Fragment for review phase task
export const reviewPhaseTaskFragment: PromptFragment<Record<string, never>> = {
    id: "review-phase-task",
    priority: 30,
    template: () => `Coordinate review activities:
1. Run tests and verify they pass
2. Check code quality and standards
3. Validate against original requirements
4. Request expert reviews where needed
5. Prepare summary of findings`,
};

// Fragment for phase-specific next actions
interface PhaseNextActionsArgs {
    availableActions: string[];
}

export const phaseNextActionsFragment: PromptFragment<PhaseNextActionsArgs> = {
    id: "phase-next-actions",
    priority: 50,
    template: ({ availableActions }) => {
        if (availableActions.length === 0) return "";

        return `Available next actions:
${availableActions.map((action) => `- ${action}`).join("\n")}`;
    },
    validateArgs: (args): args is PhaseNextActionsArgs => {
        return (
            typeof args === "object" &&
            args !== null &&
            Array.isArray((args as PhaseNextActionsArgs).availableActions)
        );
    },
};

// Register all fragments
fragmentRegistry.register(phaseConversationContextFragment);
fragmentRegistry.register(chatPhaseGuidelinesFragment);
fragmentRegistry.register(planPhaseTaskFragment);
fragmentRegistry.register(executePhaseTaskFragment);
fragmentRegistry.register(reviewPhaseTaskFragment);
fragmentRegistry.register(phaseNextActionsFragment);
