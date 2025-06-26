export type Phase = "chat" | "brainstorm" | "plan" | "execute" | "review" | "chores";

export const PHASES = {
    CHAT: "chat" as const,
    BRAINSTORM: "brainstorm" as const,
    PLAN: "plan" as const,
    EXECUTE: "execute" as const,
    REVIEW: "review" as const,
    CHORES: "chores" as const,
} as const;

export const ALL_PHASES: readonly Phase[] = [
    PHASES.CHAT,
    PHASES.BRAINSTORM,
    PHASES.PLAN,
    PHASES.EXECUTE,
    PHASES.REVIEW,
    PHASES.CHORES,
] as const;

export const PHASE_DESCRIPTIONS = {
    [PHASES.CHAT]: "Requirements gathering and discussion",
    [PHASES.BRAINSTORM]: "Creative exploration and ideation",
    [PHASES.PLAN]: "Planning implementation for complex tasks",
    [PHASES.EXECUTE]: "Implementation and coding",
    [PHASES.REVIEW]: "Code review and validation",
    [PHASES.CHORES]: "Cleanup and documentation tasks",
} as const;

export const PHASE_TRANSITIONS = {
    [PHASES.CHAT]: [PHASES.EXECUTE, PHASES.PLAN, PHASES.BRAINSTORM],
    [PHASES.BRAINSTORM]: [PHASES.CHAT, PHASES.PLAN, PHASES.EXECUTE],
    [PHASES.PLAN]: [PHASES.EXECUTE],
    [PHASES.EXECUTE]: [PHASES.REVIEW, PHASES.CHAT],
    [PHASES.REVIEW]: [PHASES.CHORES, PHASES.EXECUTE, PHASES.CHAT],
    [PHASES.CHORES]: [PHASES.CHAT],
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