import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";
import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/types";
import type { Conversation } from "@/conversations/types";
import { buildAgentPrompt } from "./agent-common";

// Agent system prompt fragment
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
    parts.push(buildAgentPrompt({
      name: agent.name,
      role: agent.role,
      instructions: agent.instructions || '',
      projectName: projectTitle
    }));
    
    // Add expertise if available
    if (agent.expertise) {
      parts.push(`## Your Expertise\n${agent.expertise}`);
    }
    
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
      parts.push(getToolInstructions());
    } else {
      parts.push("No tools assigned");
    }
    
    parts.push(`Remember: You are currently in the ${phase} phase. Focus your responses accordingly.`);
    
    return parts.join("\n\n");
  },
};

// Conversation history fragment
interface ConversationHistoryArgs {
  history: Conversation["history"];
  maxMessages?: number;
}

export const conversationHistoryFragment: PromptFragment<ConversationHistoryArgs> = {
  id: "conversation-history",
  priority: 20,
  template: ({ history, maxMessages = 10 }) => {
    const recentHistory = history.slice(-maxMessages);

    const context = recentHistory
      .map((event) => {
        const author = event.tags.find((tag) => tag[0] === "p")?.[1] || "User";
        const timestamp = new Date((event.created_at || 0) * 1000).toISOString();
        return `[${timestamp}] ${author}: ${event.content}`;
      })
      .join("\n\n");

    return `## Conversation History (Last ${recentHistory.length} messages)
${context || "No previous messages"}`;
  },
};

// Phase instructions fragment - extracted for reusability
interface PhaseInstructionsArgs {
  phase: Phase;
}

export const phaseInstructionsFragment: PromptFragment<PhaseInstructionsArgs> = {
  id: "phase-instructions",
  priority: 20,
  template: ({ phase }) => {
    return `## Phase Instructions\n${getPhaseInstructions(phase)}`;
  },
};

// Phase context fragment
interface PhaseContextArgs {
  phase: Phase;
  phaseMetadata?: Record<string, unknown>;
}

export const phaseContextFragment: PromptFragment<PhaseContextArgs> = {
  id: "phase-context",
  priority: 25,
  template: ({ phase, phaseMetadata }) => {
    let context = "";

    switch (phase) {
      case "chat":
        context = `You are in the initial phase. Focus on:
- Quickly understanding the user's request
- Taking immediate action if the request is clear
- Only clarifying when genuinely necessary (request is ambiguous)
- Transitioning to the appropriate phase as soon as possible`;
        break;

      case "plan":
        context = `You are in the planning phase. Focus on:
- Creating a detailed technical plan
- Breaking down the work into milestones
- Identifying dependencies and risks
- Estimating effort and timelines`;
        break;

      case "execute":
        context = `You are in the execution phase. Focus on:
- Implementing the planned features
- Writing clean, maintainable code
- Following best practices
- Communicating progress and blockers`;
        break;

      case "review":
        context = `You are in the review phase. Focus on:
- Evaluating the implementation quality
- Identifying bugs or issues
- Suggesting improvements
- Ensuring requirements are met`;
        break;
    }

    // Add conversation-specific context from metadata
    const phaseKey = `${phase}Context`;
    if (phaseMetadata?.[phaseKey]) {
      context += `\n\n## Additional Context for ${phase} phase:\n${phaseMetadata[phaseKey]}`;
    }

    return context;
  },
};

// Tool context fragment
interface ToolContextArgs {
  tools: string[];
}

export const toolContextFragment: PromptFragment<ToolContextArgs> = {
  id: "tool-context",
  priority: 30,
  template: ({ tools }) => {
    if (tools.length === 0) {
      return "";
    }

    return `## Tool Usage
You have access to the following tools: ${tools.join(", ")}

When you need to use a tool, format your request clearly:
- For file operations: Specify the exact file path and operation
- For shell commands: Provide the complete command with all arguments
- For web searches: Use specific, relevant search terms

Tool results will be automatically executed and included in your response.`;
  },
};

// Full prompt assembly fragment
interface FullPromptArgs {
  conversationContent: string;
  phaseContext: string;
  constraints?: string[];
  agentType?: string;
}

export const fullPromptFragment: PromptFragment<FullPromptArgs> = {
  id: "full-prompt",
  priority: 100, // Last to execute
  template: ({
    conversationContent,
    phaseContext,
    constraints = [],
    agentType = "project assistant",
  }) => {
    return `${conversationContent}

${phaseContext}

${constraints.length > 0 ? `## Constraints\n${constraints.join("\n")}` : ""}

Based on the above context, provide your response as the ${agentType}.`;
  },
};

// Helper functions (these remain as internal utilities)
function getPhaseInstructions(phase: Phase): string {
  switch (phase) {
    case "chat":
      return "Gather requirements and understand the user's needs. Ask clarifying questions to ensure you have all necessary information.";

    case "plan":
      return "Create a detailed implementation plan based on the gathered requirements. Break down the work into manageable tasks.";

    case "execute":
      return "Implement the features according to the plan. Write clean, well-tested code following best practices.";

    case "review":
      return "Review the implementation for quality, security, and completeness. Provide constructive feedback and suggestions.";

    default:
      return "Assist with the current task to the best of your ability.";
  }
}

function getToolInstructions(): string {
  return `## Tool Instructions
When you need to perform actions, use the appropriate tool syntax:

### File Operations (file tool)
- Read: <read>path/to/file</read>
- Write: <write file="path/to/file">content</write>
- Edit: <edit file="path/to/file" from="old text" to="new text"/>

### Shell Commands (shell tool)
- Execute: <execute>command</execute>

### Claude Code (claude_code tool)
- Run mode: <claude_code>prompt describing the task</claude_code>
- Plan mode: <claude_code mode="plan">prompt describing what to plan</claude_code>

Use Claude Code for complex tasks that require:
- Multi-file analysis or refactoring
- Understanding complex code relationships
- Searching for patterns across the codebase
- Implementing features that span multiple files
- Any task that would benefit from Claude's advanced capabilities

Tools will be executed automatically and results will be included in your response.`;
}

// Register all fragments
fragmentRegistry.register(agentSystemPromptFragment);
fragmentRegistry.register(conversationHistoryFragment);
fragmentRegistry.register(phaseInstructionsFragment);
fragmentRegistry.register(phaseContextFragment);
fragmentRegistry.register(toolContextFragment);
fragmentRegistry.register(fullPromptFragment);
