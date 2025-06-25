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
                "Default to action - most tasks can go directly to execution",
                "Only clarify when ambiguity would lead to fundamentally different implementations",
                "Assume reasonable defaults for common development tasks",
            ];

        case "plan":
            return [
                "Reserved for genuinely complex architectural decisions",
                "Only plan when multiple competing technical approaches exist",
                "Focus on system design, not implementation details",
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

You are moving to planning because the task is complex and requires strategic thinking. In your transition message, include:

1. **Complexity Justification**: Why this task needs planning (e.g., multiple components, unclear approach, architectural decisions)
2. **Ambiguities to Resolve**: What implementation questions need answering
3. **Technical Challenges**: Complex integrations or design patterns needed
4. **Alternative Approaches**: Different ways to implement this feature
5. **Risk Areas**: Potential pitfalls or difficult aspects

Remember: Only use planning for genuinely complex tasks. Simple tasks should go directly to execution.`;
    }
    
    if (fromPhase === 'chat' && toPhase === 'execute') {
        return `
## Transitioning to EXECUTE Phase (Skipping Planning)

You are moving directly to execution because this task is straightforward. In your transition message, include:

1. **Task Summary**: Clear description of what needs to be done
2. **Implementation Approach**: The obvious way to implement this
3. **Specific Requirements**: Any constraints or specifics from the user
4. **Expected Outcome**: What the result should look like

This is a simple task that doesn't require planning - proceed directly to implementation.`;
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