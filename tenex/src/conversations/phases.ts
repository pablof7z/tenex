export type Phase = "chat" | "brainstorm" | "plan" | "execute" | "review" | "chores" | "reflection";

export const PHASES = {
    CHAT: "chat" as const,
    BRAINSTORM: "brainstorm" as const,
    PLAN: "plan" as const,
    EXECUTE: "execute" as const,
    REVIEW: "review" as const,
    CHORES: "chores" as const,
    REFLECTION: "reflection" as const,
} as const;

export const ALL_PHASES: readonly Phase[] = [
    PHASES.CHAT,
    PHASES.BRAINSTORM,
    PHASES.PLAN,
    PHASES.EXECUTE,
    PHASES.REVIEW,
    PHASES.CHORES,
    PHASES.REFLECTION,
] as const;

export const PHASE_DESCRIPTIONS = {
    [PHASES.CHAT]: "Requirements gathering and discussion",
    [PHASES.BRAINSTORM]: "Creative exploration and ideation",
    [PHASES.PLAN]: "Planning implementation for complex tasks",
    [PHASES.EXECUTE]: "Implementation and coding",
    [PHASES.REVIEW]: "Code review and validation",
    [PHASES.CHORES]: "Cleanup and documentation tasks",
    [PHASES.REFLECTION]: "Learn from mistakes and gather insights",
} as const;

export interface PhaseDefinition {
    description: string;
    goal: string;
    whenToUse: string[];
    doNot?: string[];
    constraints: string[];
}

export const PHASE_DEFINITIONS: Record<Phase, PhaseDefinition> = {
    [PHASES.CHAT]: {
        description: "Requirements gathering and discussion",
        goal: "Clarify intent. Once the user's instruction is actionable, immediately move to execute.",
        whenToUse: [
            "The user's request is unclear or ambiguous",
            "You need to confirm what the user wants to happen",
            "The request is missing necessary inputs or context"
        ],
        doNot: [
            "Analyze the codebase",
            "Attempt to implement",
            "Delay action if the user's demand is clear",
            "If the user's command contains an imperative verb + concrete target (e.g. 'add', 'remove', 'replace') and no explicit question, switch to execute without further checks"
        ],
        constraints: [
            "Default to action - most tasks can go directly to execution"
        ]
    },
    [PHASES.BRAINSTORM]: {
        description: "Creative exploration and ideation",
        goal: "Help the user explore and narrow down ideas.",
        whenToUse: [
            "The user is exploring possibilities or asking open-ended questions",
            "The request is abstract, conceptual, or speculative",
            "No specific goal or output is defined yet"
        ],
        constraints: [
            "Focus on exploration and ideation rather than concrete requirements",
            "Encourage creative thinking and alternative perspectives",
            "Don't rush to converge on solutions - embrace open-ended discussion",
            "Only transition out when user explicitly requests it",
            "Ask probing questions to deepen understanding"
        ]
    },
    [PHASES.PLAN]: {
        description: "Planning implementation for complex tasks",
        goal: "Produce architectural diagrams, technical specs, or design steps.",
        whenToUse: [
            "The user is asking for a system or architectural design",
            "The request involves multiple components, tradeoffs, or integrations",
            "The 'how' requires structured design before implementation"
        ],
        constraints: [
            "Reserved for genuinely complex architectural decisions",
            "Only plan when multiple competing technical approaches exist",
            "Focus on system design, not implementation details"
        ]
    },
    [PHASES.EXECUTE]: {
        description: "Implementation and coding",
        goal: "Implement the task. Code, test, and deliver.",
        whenToUse: [
            "The user gives a clear implementation instruction",
            "The request involves writing or modifying code",
            "You know what to build"
        ],
        doNot: [
            "Analyze or try to 'understand' the codebase here — the implementation agents handle that"
        ],
        constraints: [
            "Use the claude_code tool for all project modifications",
            "Never directly modify project files - always use claude_code",
            "Focus on implementation details",
            "Provide code examples when relevant",
            "Explain technical decisions"
        ]
    },
    [PHASES.REVIEW]: {
        description: "Code review and validation",
        goal: "Verify the output, catch issues, and return to the user or next phase.",
        whenToUse: [
            "The implementation is complete",
            "The work needs validation for correctness and completeness",
            "You want a quality check before closing the task"
        ],
        constraints: [
            "Provide constructive feedback",
            "Highlight both strengths and areas for improvement",
            "Suggest specific improvements"
        ]
    },
    [PHASES.CHORES]: {
        description: "Cleanup and documentation tasks",
        goal: "Clean up and document recent changes.",
        whenToUse: [
            "Implementation is complete and needs documentation",
            "Project files have been modified and inventory needs updating",
            "Need to organize or clean up temporary work"
        ],
        constraints: [
            "Focus on updating documentation and inventory for modified code",
            "Use generate_inventory tool to update project documentation",
            "Clean up any temporary files or unfinished work",
            "Ensure all changes are properly documented",
            "Consider generating guides for complex modules"
        ]
    },
    [PHASES.REFLECTION]: {
        description: "Learn from mistakes and gather insights",
        goal: "Reflect on the work done, learn from mistakes, and record valuable insights.",
        whenToUse: [
            "After completing significant work or fixing complex issues",
            "When mistakes were made and corrected during execution",
            "When discovering important patterns or best practices",
            "At the end of a project iteration or milestone"
        ],
        constraints: [
            "Use the learn tool to record important lessons and insights",
            "Focus on actionable learnings that prevent future mistakes",
            "Record project-specific knowledge for PM's understanding",
            "Be concise and specific in lessons learned",
            "Include relevant keywords for future retrieval"
        ]
    }
} as const;

export const PHASE_TRANSITIONS = {
    [PHASES.CHAT]: [PHASES.EXECUTE, PHASES.PLAN, PHASES.BRAINSTORM],
    [PHASES.BRAINSTORM]: [PHASES.CHAT, PHASES.PLAN, PHASES.EXECUTE],
    [PHASES.PLAN]: [PHASES.EXECUTE],
    [PHASES.EXECUTE]: [PHASES.REVIEW, PHASES.CHAT],
    [PHASES.REVIEW]: [PHASES.CHORES, PHASES.EXECUTE, PHASES.CHAT],
    [PHASES.CHORES]: [PHASES.REFLECTION],
    [PHASES.REFLECTION]: [PHASES.CHAT],
} as const;

export function isValidPhase(phase: string): phase is Phase {
    return ALL_PHASES.includes(phase as Phase);
}

export function getValidTransitions(currentPhase: Phase): readonly Phase[] {
    return PHASE_TRANSITIONS[currentPhase] || [];
}

export function canTransitionTo(currentPhase: Phase, targetPhase: Phase): boolean {
    return getValidTransitions(currentPhase).includes(targetPhase);
}
