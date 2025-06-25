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

    if (toolInstructions.length === 0) {
        return "";
    }

    return `
## Tool Instructions

🚨 **CRITICAL: DO NOT HALLUCINATE TOOL RESULTS** 🚨
- You ONLY write <tool_use> blocks with JSON: <tool_use>{"tool": "name", "args": {...}}</tool_use>
- You NEVER write <tool_result> blocks or fake outputs  
- The system executes tools and provides real results
- ANY fake results will break the system

${toolInstructions.join("\n\n")}`;
}

// Tool use guidelines fragment - comprehensive guidance on proper tool usage
export const toolUseGuidelinesFragment: PromptFragment<{}> = {
    id: "tool-use-guidelines",
    priority: 0, // Highest priority - appears first
    template: () => {
        return `# Tool Use Guidelines

🚨 **CRITICAL: NEVER FABRICATE TOOL RESULTS** 🚨

1. **Think Before Using Tools**: Assess what information you already have and what you need to proceed with the task.

2. **Choose Appropriate Tools**: Select the most effective tool for each step. Consider all available tools and choose the one that best fits the current need.

3. **One Tool Per Message**: Use one tool at a time per message to accomplish tasks iteratively. Each tool use must be informed by the result of the previous tool use.

4. **Use Correct Format**: Write tool uses as JSON wrapped in XML tags:
   \`\`\`
   <tool_use>
   {"tool": "tool_name", "args": {"param": "value"}}
   </tool_use>
   \`\`\`

5. **Wait for Real Results**: After each tool use, the system will automatically execute it and provide real results. This response will include:
   - Success or failure status with reasons
   - Actual output or error messages  
   - Any relevant feedback or information

6. **NEVER Assume Outcomes**: Do not assume the success of any tool use. Do not fabricate or guess tool results. Always wait for the actual system response.

7. **Proceed Step-by-Step**: Build each action on the results of previous ones. Address any issues or errors immediately before proceeding.

8. **Tool Use Placement**: When using a tool, MUST place the tool_use block at the very end of that message. Complete all natural language explanation first, then conclude with a single tool_use block.

**FORBIDDEN**: 
- Writing fake tool_result blocks
- Guessing or assuming tool outputs
- Proceeding without actual results
- Placing tool_use blocks anywhere except at the very end of your output

This iterative approach ensures accuracy and allows you to adapt based on real results at each step.`;
    },
};

// Utility function to get standalone tool use guidelines
export function getToolUseGuidelinesSection(): string {
    return toolUseGuidelinesFragment.template({});
}

// Register fragments
fragmentRegistry.register(toolUseGuidelinesFragment);
fragmentRegistry.register(agentSystemPromptFragment);
fragmentRegistry.register(phaseContextFragment);
fragmentRegistry.register(customInstructionsFragment);