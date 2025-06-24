import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

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

// Register fragments
fragmentRegistry.register(toolContinuationPromptFragment);
fragmentRegistry.register(phaseConstraintsFragment);