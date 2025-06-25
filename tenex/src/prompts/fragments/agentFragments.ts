import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";
import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/types";
import type { Conversation } from "@/conversations/types";
import { buildAgentPrompt } from "./agent-common";
import { getTool } from "@/tools/registry";

// ========================================================================
// EXECUTION & SYSTEM PROMPT FRAGMENTS
// ========================================================================

// Complete agent system prompt for execution
interface AgentSystemPromptArgs {
    agent: Agent;
    phase: Phase;
    projectTitle: string;
}

export const agentSystemPromptFragment: PromptFragment<AgentSystemPromptArgs> = {
    id: "agent-system-prompt",
    priority: 1,
    template: ({ agent, phase, projectTitle }) => {
        const parts: string[] = [];

        // Use shared agent prompt builder
        parts.push(
            buildAgentPrompt({
                name: agent.name,
                role: agent.role,
                instructions: agent.instructions || "",
                projectName: projectTitle,
            })
        );

        // Phase info
        parts.push(`## Current Phase: ${phase.toUpperCase()}\n${getPhaseInstructions(phase)}`);

        // Communication style
        parts.push(`## Communication Style
- Be concise and focused on the task at hand
- Default to action rather than asking questions
- Make reasonable technical decisions without consultation
- Only ask questions when the ambiguity would cause fundamentally different implementations`);

        // Tools section
        parts.push("## Available Tools");
        if (agent.tools && agent.tools.length > 0) {
            parts.push(agent.tools.join(", "));
            parts.push(getToolInstructions(agent.tools));
        } else {
            parts.push("No tools assigned");
        }

        parts.push(
            `Remember: You are currently in the ${phase} phase. Focus your responses accordingly.`
        );

        return parts.join("\n\n");
    },
};

// ========================================================================
// CONVERSATION & INTERACTION FRAGMENTS
// ========================================================================

// Phase context
interface PhaseContextArgs {
    phase: Phase;
    phaseMetadata?: Record<string, unknown>;
    conversation?: Conversation;
}

export const phaseContextFragment: PromptFragment<PhaseContextArgs> = {
    id: "phase-context",
    priority: 15,
    template: ({ phase, conversation }) => {
        const parts = [`## Current Phase: ${phase.toUpperCase()}`];

        // Add phase-specific context from conversation transitions
        const context = getPhaseContext(phase, conversation);
        if (context) {
            parts.push(context);
        }

        return parts.join("\n\n");
    },
    validateArgs: (args): args is PhaseContextArgs => {
        return (
            typeof args === "object" &&
            args !== null &&
            typeof (args as PhaseContextArgs).phase === "string"
        );
    },
};

// Custom instructions from agent definition
interface CustomInstructionsArgs {
    instructions: string;
}

export const customInstructionsFragment: PromptFragment<CustomInstructionsArgs> = {
    id: "custom-instructions",
    priority: 5,
    template: ({ instructions }) => {
        if (!instructions.trim()) return "";
        return `## Instructions\n${instructions}`;
    },
};

// ========================================================================
// HELPER FUNCTIONS
// ========================================================================

function getPhaseInstructions(phase: Phase): string {
    switch (phase) {
        case "chat":
            return `In the CHAT phase, you should:
- Quickly understand the user's requirements and proceed to execution
- Skip to execute phase for most tasks unless they're architecturally complex
- Only ask questions if the answer would fundamentally change the implementation
- Treat implementation as the default response to most requests`;

        case "plan":
            return `In the PLAN phase, you should:
- Focus on complex tasks that have ambiguous implementation paths
- Break down multi-component features into manageable steps
- Identify architectural decisions and trade-offs
- Map out dependencies and integration points
- Only create plans when the implementation approach is genuinely unclear`;

        case "execute":
            return `In the EXECUTE phase, you should:
- Implement the planned solutions step by step
- Provide working code and configurations
- Test implementations thoroughly
- Document your progress and any deviations from the plan`;

        case "review":
            return `In the REVIEW phase, you should:
- Assess the quality of implementations
- Provide constructive feedback
- Identify areas for improvement
- Validate that requirements have been met`;

        default:
            return "Focus on the current task and provide value to the user.";
    }
}

function getPhaseContext(phase: Phase, conversation?: Conversation): string | null {
    if (!conversation?.phaseTransitions?.length) {
        return null;
    }
    
    // Get the most recent transition into this phase
    const latestTransition = conversation.phaseTransitions
        .filter(t => t.to === phase)
        .sort((a, b) => b.timestamp - a.timestamp)[0];
    
    if (latestTransition) {
        return `### Context from Previous Phase\n${latestTransition.message}`;
    }
    
    return null;
}

function getToolInstructions(tools: string[]): string {
    const toolInstructions: string[] = [];

    for (const toolName of tools) {
        const tool = getTool(toolName);
        if (tool?.instructions) {
            toolInstructions.push(`### ${toolName}\n${tool.instructions}`);
        }
    }

    return toolInstructions.length > 0
        ? "\n## Tool Instructions\n" + toolInstructions.join("\n\n")
        : "";
}

// Register fragments
fragmentRegistry.register(agentSystemPromptFragment);
fragmentRegistry.register(phaseContextFragment);
fragmentRegistry.register(customInstructionsFragment);