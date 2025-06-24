import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";
import type { Phase } from "@/conversations/types";

// Tool continuation prompt fragment - used by ReasonActLoop
interface ToolContinuationPromptArgs {
    processedContent: string;
}

export const toolContinuationPromptFragment: PromptFragment<ToolContinuationPromptArgs> = {
    id: "tool-continuation-prompt",
    priority: 10,
    template: ({ processedContent }) => processedContent,
};

// Phase constraints fragment - used by AgentExecutor
interface PhaseConstraintsArgs {
    phase: string;
}

export const phaseConstraintsFragment: PromptFragment<PhaseConstraintsArgs> = {
    id: "phase-constraints",
    priority: 20,
    template: ({ phase }) => {
        const constraints = getPhaseConstraints(phase);
        if (constraints.length === 0) return "";
        
        return `## Phase Constraints
${constraints.map(c => `- ${c}`).join("\n")}`;
    },
};

function getPhaseConstraints(phase: string): string[] {
    switch (phase) {
        case "chat":
            return [
                "Focus on understanding requirements",
                "Ask clarifying questions",
                "Keep responses concise and friendly",
            ];

        case "plan":
            return [
                "Create a structured plan with clear milestones",
                "Include time estimates when possible",
                "Identify potential risks or challenges",
            ];

        case "execute":
            return [
                "Focus on implementation details",
                "Provide code examples when relevant",
                "Explain technical decisions",
            ];

        case "review":
            return [
                "Provide constructive feedback",
                "Highlight both strengths and areas for improvement",
                "Suggest specific improvements",
            ];

        default:
            return [];
    }
}

// Dynamic instruction generation based on phase transition
export function getPhaseTransitionInstructions(fromPhase: Phase, toPhase: Phase): string {
    if (fromPhase === 'chat' && toPhase === 'plan') {
        return `
## Transitioning to PLAN Phase

You are moving from requirements gathering to planning. In your transition message, include:

1. **Project Overview**: Clear description of what the user wants to build
2. **Functional Requirements**: All features requested (explicit and inferred)
3. **Technical Constraints**: Language, framework, performance requirements
4. **Success Criteria**: How we'll know the project meets expectations
5. **Priorities**: If multiple features, their relative importance

Format this as a comprehensive brief that Claude Code can use to create a detailed plan.`;
    }
    
    if (fromPhase === 'plan' && toPhase === 'execute') {
        return `
## Transitioning to EXECUTE Phase

You are moving from planning to implementation. In your transition message, include:

1. **Approved Plan**: The complete implementation strategy
2. **Technical Decisions**: Architecture, patterns, libraries to use
3. **Implementation Steps**: Clear sequence of tasks
4. **Dependencies**: What needs to be done first
5. **Acceptance Criteria**: How to verify each component

This message will be sent directly to Claude Code for implementation.`;
    }
    
    if (fromPhase === 'execute' && toPhase === 'review') {
        return `
## Transitioning to REVIEW Phase

You are moving from implementation to review. In your transition message, include:

1. **Work Completed**: All files created/modified
2. **Features Implemented**: What functionality was added
3. **Tests Written**: Testing coverage
4. **Known Issues**: Any problems or limitations
5. **Review Focus**: Areas needing special attention`;
    }
    
    // Default for other transitions
    return `
## Phase Transition

Provide a comprehensive summary of the work completed in the ${fromPhase} phase
and clear context for the ${toPhase} phase.`;
}

// Register fragments
fragmentRegistry.register(toolContinuationPromptFragment);
fragmentRegistry.register(phaseConstraintsFragment);