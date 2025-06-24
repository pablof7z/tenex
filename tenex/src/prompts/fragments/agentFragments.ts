import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";
import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/types";
import type { Conversation } from "@/conversations/types";
import { buildAgentPrompt } from "./agent-common";
import { isEventFromUser, getAgentSlugFromEvent } from "@/nostr/utils";
import { getTool } from "@/tools/registry";

// ========================================================================
// EXECUTION & SYSTEM PROMPT FRAGMENTS
// ========================================================================

// Complete agent system prompt for execution
interface AgentSystemPromptArgs {
    agent: Agent;
    phase: Phase;
    projectTitle: string;
    projectRepository?: string;
}

export const agentSystemPromptFragment: PromptFragment<AgentSystemPromptArgs> = {
    id: "agent-system-prompt",
    priority: 10,
    template: ({ agent, phase, projectTitle, projectRepository }) => {
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

        // Repository if available
        if (projectRepository) {
            parts.push(`Repository: ${projectRepository}`);
        }

        // Communication style
        parts.push(`## Communication Style
- Be concise and focused on the task at hand
- Provide actionable insights and clear next steps
- When suggesting code changes, be specific about what to change
- Ask clarifying questions when requirements are unclear`);

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

// Conversation history
interface ConversationHistoryArgs {
    history: Conversation["history"];
    maxMessages?: number;
}

export const conversationHistoryFragment: PromptFragment<ConversationHistoryArgs> = {
    id: "conversation-history",
    priority: 10,
    template: ({ history, maxMessages = 20 }) => {
        if (history.length === 0) {
            return "## Conversation History\nNo messages yet.";
        }

        // Get last N messages
        const recentHistory = history.slice(-maxMessages);

        const formattedHistory = recentHistory
            .map((event, index) => {
                const isUser = isEventFromUser(event);
                const author = isUser ? "User" : getAgentSlugFromEvent(event) || "Agent";
                return `[${index + 1}] ${author}: ${event.content}`;
            })
            .join("\n\n");

        return `## Conversation History (Last ${recentHistory.length} messages)
${formattedHistory}`;
    },
    validateArgs: (args): args is ConversationHistoryArgs => {
        return (
            typeof args === "object" &&
            args !== null &&
            Array.isArray((args as ConversationHistoryArgs).history)
        );
    },
};

// Phase context
interface PhaseContextArgs {
    phase: Phase;
    phaseMetadata?: Record<string, unknown>;
}

export const phaseContextFragment: PromptFragment<PhaseContextArgs> = {
    id: "phase-context",
    priority: 15,
    template: ({ phase, phaseMetadata }) => {
        const parts = [`## Current Phase: ${phase.toUpperCase()}`];

        // Add phase-specific context
        const context = getPhaseContext(phase, phaseMetadata);
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
- Focus on understanding the user's requirements
- Ask clarifying questions to gather necessary information
- Keep responses concise and conversational
- Build rapport and ensure clear communication`;

        case "plan":
            return `In the PLAN phase, you should:
- Create detailed implementation plans based on requirements
- Break down complex tasks into manageable steps
- Identify potential challenges and solutions
- Provide clear timelines and milestones`;

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

function getPhaseContext(phase: Phase, metadata?: Record<string, unknown>): string | null {
    switch (phase) {
        case "plan":
            if (metadata?.requirements) {
                return `### Requirements to Address\n${metadata.requirements}`;
            }
            break;
        case "execute":
            if (metadata?.plan) {
                return `### Current Plan\n${metadata.plan}`;
            }
            break;
        case "review":
            if (metadata?.workToReview) {
                return `### Work to Review\n${metadata.workToReview}`;
            }
            break;
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
fragmentRegistry.register(conversationHistoryFragment);
fragmentRegistry.register(phaseContextFragment);
fragmentRegistry.register(customInstructionsFragment);