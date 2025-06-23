import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";
import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/types";
import type { Conversation } from "@/conversations/types";
import { buildAgentPrompt, buildAgentIdentity } from "./agent-common";
import { isEventFromUser, getAgentSlugFromEvent } from "@/nostr/utils";

// ========================================================================
// IDENTITY & PROFILE FRAGMENTS
// ========================================================================

// Basic agent identity - Used when an agent introduces itself
interface AgentIdentityArgs {
  name: string;
  role: string;
}

export const agentIdentityFragment: PromptFragment<AgentIdentityArgs> = {
  id: "agent-identity",
  priority: 5,
  template: ({ name, role }) =>
    `You are ${name}, a ${role}.`,
};

// Agent profile with capabilities - More detailed agent description
interface AgentProfileArgs {
  profile: {
    name: string;
    role: string;
    description: string;
    capabilities?: string[];
  };
}

export const agentProfileFragment: PromptFragment<AgentProfileArgs> = {
  id: "agent-profile",
  priority: 15,
  template: ({ profile }) => {
    let prompt = `Your identity:
- Name: ${profile.name}
- Role: ${profile.role}
- Description: ${profile.description}`;

    if (profile.capabilities && profile.capabilities.length > 0) {
      prompt += `\n- Capabilities: ${profile.capabilities.join(", ")}`;
    }

    return prompt;
  },
};

// Core agent behavior - Basic AI agent instructions
export const agentCoreFragment: PromptFragment<Record<string, never>> = {
  id: "agent-core",
  priority: 5,
  template: () => `You are an AI agent that helps users with tasks.
You should be helpful, accurate, and follow instructions carefully.`,
};

// ========================================================================
// CUSTOM INSTRUCTIONS & CONTEXT FRAGMENTS
// ========================================================================

// Custom instructions - Additional agent-specific instructions
interface CustomInstructionsArgs {
  content: string;
}

export const customInstructionsFragment: PromptFragment<CustomInstructionsArgs> = {
  id: "custom-instructions",
  priority: 8,
  template: ({ content }) => `Additional instructions:\n${content}`,
};

// Agent base - Full agent configuration using helper
interface AgentBaseArgs {
  agent: {
    name: string;
    instructions: string;
    role?: string;
  };
  project?: {
    name: string;
    description?: string;
  };
}

export const agentBaseFragment: PromptFragment<AgentBaseArgs> = {
  id: "agent-base",
  priority: 10,
  template: ({ agent, project }) => {
    return buildAgentPrompt({
      name: agent.name,
      role: agent.role,
      instructions: agent.instructions,
      projectName: project?.name
    });
  },
};

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
    parts.push(buildAgentPrompt({
      name: agent.name,
      role: agent.role,
      instructions: agent.instructions || '',
      projectName: projectTitle
    }));
    
    
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
    
    parts.push(`Remember: You are currently in the ${phase} phase. Focus your responses accordingly.`);
    
    return parts.join("\n\n");
  },
};

// ========================================================================
// CONVERSATION & INTERACTION FRAGMENTS
// ========================================================================

// Agent conversation context
interface AgentConversationContextArgs {
  conversationTitle: string;
  phase: string;
  currentTask: string;
}

export const agentConversationContextFragment: PromptFragment<AgentConversationContextArgs> = {
  id: "agent-conversation-context",
  priority: 20,
  template: ({ conversationTitle, phase, currentTask }) => {
    return `Conversation: ${conversationTitle}
Phase: ${phase}
Current task: ${currentTask}`;
  },
  validateArgs: (args): args is AgentConversationContextArgs => {
    return typeof args === 'object' && 
           args !== null && 
           typeof (args as any).conversationTitle === 'string' &&
           typeof (args as any).phase === 'string' &&
           typeof (args as any).currentTask === 'string';
  }
};

// Conversation history
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
        const author = isEventFromUser(event) ? "User" : getAgentSlugFromEvent(event) || "Assistant";
        const timestamp = new Date((event.created_at || 0) * 1000).toISOString();
        return `[${timestamp}] ${author}: ${event.content}`;
      })
      .join("\n\n");

    return `## Conversation History (Last ${recentHistory.length} messages)
${context || "No previous messages"}`;
  },
};

// ========================================================================
// PHASE-RELATED FRAGMENTS
// ========================================================================

// Phase instructions
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

// Phase context with metadata
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
- Being helpful and responsive to the user's needs`;
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

// ========================================================================
// ACTION & RESPONSE FRAGMENTS
// ========================================================================

// Agent next action options
interface AgentNextActionArgs {
  availableActions: string[];
}

export const agentNextActionFragment: PromptFragment<AgentNextActionArgs> = {
  id: "agent-next-action",
  priority: 50,
  template: ({ availableActions }) => {
    if (availableActions.length === 0) return '';
    
    return `Available next actions:
${availableActions.map(action => `- ${action}`).join('\n')}`;
  },
  validateArgs: (args): args is AgentNextActionArgs => {
    return typeof args === 'object' && 
           args !== null && 
           Array.isArray((args as any).availableActions);
  }
};

// Agent response schema
export const agentResponseSchemaFragment: PromptFragment<Record<string, never>> = {
  id: "agent-response-schema",
  priority: 80,
  template: () => `{
  "response": "your response to the task",
  "toolCalls": [{"tool": "name", "args": {}}], // optional
  "nextAction": {
    "type": "handoff|phase_transition|complete|human_input|continue",
    "target": "pubkey or phase name", // if applicable
    "reasoning": "why this action"
  }
}`
};

// ========================================================================
// REVIEW & FEEDBACK FRAGMENTS
// ========================================================================

// Review context - For general review scenarios
interface ReviewContextArgs {
  content: string;
}

export const reviewContextFragment: PromptFragment<ReviewContextArgs> = {
  id: "review-context",
  priority: 22,
  template: ({ content }) => content,
};

// Work to review - Content being reviewed
interface WorkToReviewArgs {
  content: string;
}

export const workToReviewFragment: PromptFragment<WorkToReviewArgs> = {
  id: "work-to-review",
  priority: 28,
  template: ({ content }) => content,
};

// Expert feedback context
interface ExpertFeedbackContextArgs {
  context: string;
  workToReview: string;
}

export const expertFeedbackContextFragment: PromptFragment<ExpertFeedbackContextArgs> = {
  id: "expert-feedback-context",
  priority: 25,
  template: ({ context, workToReview }) => {
    return `Context: ${context}

Work to review:
${workToReview}`;
  },
  validateArgs: (args): args is ExpertFeedbackContextArgs => {
    return typeof args === 'object' && 
           args !== null && 
           typeof (args as any).context === 'string' &&
           typeof (args as any).workToReview === 'string';
  }
};

// Expert feedback task instructions
export const expertFeedbackTaskFragment: PromptFragment<Record<string, never>> = {
  id: "expert-feedback-task",
  priority: 30,
  template: () => `Provide feedback focusing on:
1. Technical correctness within your expertise
2. Best practices and standards
3. Potential issues or improvements
4. Whether this meets the requirements

Be constructive and specific.`
};

// Expert feedback response schema
export const expertFeedbackResponseFragment: PromptFragment<Record<string, never>> = {
  id: "expert-feedback-response",
  priority: 80,
  template: () => `{
  "feedback": "your detailed feedback",
  "confidence": 0.0-1.0,
  "issues": ["list of specific issues found"], // optional
  "suggestions": ["list of improvements"], // optional
  "approved": true|false
}`
};

// ========================================================================
// TOOL-RELATED FRAGMENTS
// ========================================================================

// Tool context
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

// ========================================================================
// ASSEMBLY FRAGMENTS
// ========================================================================

// Full prompt assembly
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

// ========================================================================
// HELPER FUNCTIONS
// ========================================================================

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

function getToolInstructions(availableTools: string[]): string {
  if (availableTools.length === 0) {
    return "";
  }

  const toolInstructions: Record<string, string> = {
    file: `### File Operations (file tool)
- Read: <read>path/to/file</read>
- Write: <write file="path/to/file">content</write>
- Edit: <edit file="path/to/file" from="old text" to="new text"/>`,

    shell: `### Shell Commands (shell tool)
- Execute: <execute>command</execute>`,

    claude_code: `### Claude Code (claude_code tool)
- Run mode: <claude_code>prompt describing the task</claude_code>
- Plan mode: <claude_code mode="plan">prompt describing what to plan</claude_code>

Use Claude Code for complex tasks that require:
- Multi-file analysis or refactoring
- Understanding complex code relationships
- Searching for patterns across the codebase
- Implementing features that span multiple files
- Any task that would benefit from Claude's advanced capabilities`,

    phase_transition: `### Phase Transition (phase_transition tool)
- Transition to plan: <phase_transition>plan</phase_transition>
- Transition to execute: <phase_transition>execute</phase_transition>
- Transition to review: <phase_transition>review</phase_transition>

Phase transitions follow these rules:
- From chat → plan (when requirements are clear)
- From plan → execute (when plan is approved) or chat (need more info)
- From execute → review (when implementation is complete) or plan (major changes needed)
- From review → execute (fixes needed), chat (discuss results), or chores (cleanup)`,

    get_current_requirements: `### Get Current Requirements (get_current_requirements tool)
- Extract and display current requirements: <get_current_requirements/>

Use this tool in the chat phase to:
- Show the user what requirements have been understood from the conversation
- Allow the user to verify and modify requirements before transitioning to the plan phase
- Check if requirements are clear enough to proceed`
  };

  const instructions: string[] = ["## Tool Instructions"];
  instructions.push("When you need to perform actions, use the appropriate tool syntax:");
  instructions.push("");

  for (const tool of availableTools) {
    if (toolInstructions[tool]) {
      instructions.push(toolInstructions[tool]);
      instructions.push("");
    }
  }

  instructions.push("Tools will be executed automatically and results will be included in your response.");
  
  return instructions.join("\n");
}

// ========================================================================
// REGISTER ALL FRAGMENTS
// ========================================================================

// Identity & Profile
fragmentRegistry.register(agentIdentityFragment);
fragmentRegistry.register(agentProfileFragment);
fragmentRegistry.register(agentCoreFragment);

// Custom Instructions & Context
fragmentRegistry.register(customInstructionsFragment);
fragmentRegistry.register(agentBaseFragment);

// Execution & System
fragmentRegistry.register(agentSystemPromptFragment);

// Conversation & Interaction
fragmentRegistry.register(agentConversationContextFragment);
fragmentRegistry.register(conversationHistoryFragment);

// Phase-related
fragmentRegistry.register(phaseInstructionsFragment);
fragmentRegistry.register(phaseContextFragment);

// Action & Response
fragmentRegistry.register(agentNextActionFragment);
fragmentRegistry.register(agentResponseSchemaFragment);

// Review & Feedback
fragmentRegistry.register(reviewContextFragment);
fragmentRegistry.register(workToReviewFragment);
fragmentRegistry.register(expertFeedbackContextFragment);
fragmentRegistry.register(expertFeedbackTaskFragment);
fragmentRegistry.register(expertFeedbackResponseFragment);

// Tool-related
fragmentRegistry.register(toolContextFragment);

// Assembly
fragmentRegistry.register(fullPromptFragment);