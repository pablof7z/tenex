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
  [PHASES.PLAN]: "Planning approach for complex tasks",
  [PHASES.EXECUTE]: "Implementation and execution",
  [PHASES.REVIEW]: "Quality review and validation",
  [PHASES.CHORES]: "Cleanup and documentation tasks",
  [PHASES.REFLECTION]: "Learn from experience and gather insights",
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
      "The request is missing necessary inputs or context",
    ],
    doNot: [
      "Analyze the codebase",
      "Attempt to implement",
      "Delay action if the user's demand is clear",
      "If the user's command contains an imperative verb + concrete target (e.g. 'add', 'remove', 'replace') and no explicit question, switch to execute without further checks",
    ],
    constraints: ["Default to action - most tasks can go directly to execution"],
  },
  [PHASES.BRAINSTORM]: {
    description: "Creative exploration and ideation",
    goal: "Help the user explore and narrow down ideas.",
    whenToUse: [
      "The user is exploring possibilities or asking open-ended questions",
      "The request is abstract, conceptual, or speculative",
      "No specific goal or output is defined yet",
    ],
    constraints: [
      "Focus on exploration and ideation rather than concrete requirements",
      "Encourage creative thinking and alternative perspectives",
      "Don't rush to converge on solutions - embrace open-ended discussion",
      "Only transition out when user explicitly requests it",
      "Ask probing questions to deepen understanding",
    ],
  },
  [PHASES.PLAN]: {
    description: "Planning implementation for complex tasks",
    goal: "Produce architectural diagrams, technical specs, or design steps.",
    whenToUse: [
      "The user is asking for a system or architectural design",
      "The request involves multiple components, tradeoffs, or integrations",
      "The 'how' requires structured design before implementation",
    ],
    constraints: [
      "Reserved for genuinely complex architectural decisions",
      "Only plan when multiple competing technical approaches exist",
      "Focus on system design, not implementation details",
    ],
  },
  [PHASES.EXECUTE]: {
    description: "Implementation and execution",
    goal: "Execute the task. Create, modify, or produce the requested output.",
    whenToUse: [
      "The user gives a clear instruction to create or modify something",
      "The request involves producing tangible output",
      "You know what needs to be done",
    ],
    doNot: [
      "Analyze or try to understand the entire system - execution agents handle their domain",
    ],
    constraints: [
      "Use appropriate tools for the task at hand",
      "Focus on delivering what was requested",
      "Provide relevant examples when helpful",
      "Explain key decisions made during execution",
    ],
  },
  [PHASES.REVIEW]: {
    description: "Quality review and validation",
    goal: "Verify the output meets requirements and quality standards.",
    whenToUse: [
      "The execution is complete",
      "The work needs validation for correctness and completeness",
      "Quality assurance is needed before finalizing",
    ],
    constraints: [
      "Provide constructive feedback",
      "Highlight both strengths and areas for improvement",
      "Suggest specific improvements",
    ],
  },
  [PHASES.CHORES]: {
    description: "Cleanup and documentation tasks",
    goal: "Organize work products and update documentation.",
    whenToUse: [
      "Work is complete and needs documentation",
      "Artifacts have been created or modified and need organizing",
      "Need to clean up temporary work products",
    ],
    constraints: [
      "Focus on updating documentation for recent work",
      "Use appropriate tools to maintain project organization",
      "Clean up any temporary artifacts",
      "Ensure all changes are properly documented",
      "Consider creating guides for complex work",
    ],
  },
  [PHASES.REFLECTION]: {
    description: "Learn from mistakes and gather insights",
    goal: "Reflect on the work done, learn from mistakes, and record valuable insights.",
    whenToUse: [
      "After completing significant work or fixing complex issues",
      "When mistakes were made and corrected during execution",
      "When discovering important patterns or best practices",
      "At the end of a project iteration or milestone",
    ],
    constraints: [
      "Use the learn tool to record important lessons and insights",
      "Focus on actionable learnings that prevent future mistakes",
      "Record project-specific knowledge for PM's understanding",
      "Be concise and specific in lessons learned",
      "Include relevant keywords for future retrieval",
    ],
  },
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
