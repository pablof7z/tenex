import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";
import type { Phase } from "@/conversations/phases";
import { PHASE_DEFINITIONS } from "@/conversations/phases";

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
${constraints.map((c) => `- ${c}`).join("\n")}`;
    },
};

function getPhaseConstraints(phase: string): string[] {
    const phaseDefinition = PHASE_DEFINITIONS[phase as Phase];
    return phaseDefinition?.constraints || [];
}

// Dynamic instruction generation based on phase transition
export function getPhaseTransitionInstructions(fromPhase: Phase, toPhase: Phase): string {
    if (fromPhase === "chat" && toPhase === "plan") {
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

    if (fromPhase === "chat" && toPhase === "brainstorm") {
        return `
## Transitioning to BRAINSTORM Phase

You are moving to brainstorm mode because the user's request is broad, conceptual, or abstract. In your transition message, include:

1. **Why Brainstorming**: Explain why this topic benefits from open exploration
2. **Key Themes**: Identify the main concepts to explore
3. **Potential Directions**: Suggest multiple angles to consider
4. **Questions to Explore**: Pose thought-provoking questions
5. **Creative Possibilities**: Encourage imaginative solutions

Focus on exploration rather than arriving at concrete requirements. Stay in brainstorm mode until the user explicitly asks to transition out.`;
    }

    if (fromPhase === "chat" && toPhase === "execute") {
        return `
## Transitioning to EXECUTE Phase (Skipping Planning)

You are moving directly to execution because this task is straightforward. In your transition message, include:

1. **Task Summary**: Clear description of what needs to be done
2. **Implementation Approach**: The obvious way to implement this
3. **Specific Requirements**: Any constraints or specifics from the user
4. **Expected Outcome**: What the result should look like

This is a simple task that doesn't require planning - proceed directly to implementation.`;
    }

    if (fromPhase === "plan" && toPhase === "execute") {
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

    if (fromPhase === "execute" && toPhase === "review") {
        return `
## Transitioning to REVIEW Phase

You are moving from implementation to review. In your transition message, include:

1. **Work Completed**: All files created/modified
2. **Features Implemented**: What functionality was added
3. **Tests Written**: Testing coverage
4. **Known Issues**: Any problems or limitations
5. **Review Focus**: Areas needing special attention`;
    }

    if (toPhase === "brainstorm") {
        return `
## Transitioning to BRAINSTORM Phase

You are moving to brainstorm mode for open exploration. In your transition message, include:

1. **Context from Previous Phase**: What led to this brainstorming session
2. **Exploration Focus**: What topics or concepts to explore
3. **Creative Scope**: Encourage wide-ranging discussion
4. **Questions to Consider**: Thought-provoking questions to guide exploration

Embrace open-ended discussion and creative thinking. Don't rush to concrete solutions.`;
    }

    if (fromPhase === "brainstorm") {
        return `
## Transitioning from BRAINSTORM Phase

You are moving from brainstorm mode to ${toPhase}. In your transition message, include:

1. **Key Insights**: Main ideas and concepts that emerged
2. **Promising Directions**: Most valuable paths explored
3. **Converged Understanding**: How the brainstorming refined the approach
4. **Next Steps**: Clear direction for the ${toPhase} phase

Transition the creative exploration into focused action.`;
    }

    if (fromPhase === "execute" && toPhase === "chores") {
        return `
## Transitioning to CHORES Phase

You are moving to maintenance tasks after implementation. In your transition message:

1. **Summary**: Briefly describe what was implemented
2. **Documentation Needs**: Mention that inventory should be updated
3. **Cleanup Tasks**: Any code organization needed

The chores agent will check what files were modified and update documentation accordingly.`;
    }

    if (toPhase === "chores") {
        return `
## Transitioning to CHORES Phase

You are moving to maintenance and documentation tasks. In your transition message:

1. **Context**: What work was completed in the ${fromPhase} phase
2. **Documentation Focus**: Areas that need inventory updates
3. **Maintenance Tasks**: Any cleanup or organization needed

The chores agent will analyze recent changes and update project documentation.`;
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
