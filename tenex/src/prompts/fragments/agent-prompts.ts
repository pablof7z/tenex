import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

// Fragment for agent identity
interface AgentIdentityArgs {
  name: string;
  role: string;
  expertise: string[];
}

export const agentIdentityFragment: PromptFragment<AgentIdentityArgs> = {
  id: "agent-identity",
  priority: 10,
  template: ({ name, role, expertise }) => {
    let prompt = `You are ${name}, a ${role}.`;
    
    if (expertise.length > 0) {
      prompt += `\nYour expertise includes: ${expertise.join(", ")}.`;
    }
    
    return prompt;
  },
  validateArgs: (args): args is AgentIdentityArgs => {
    return typeof args === 'object' && 
           args !== null && 
           typeof (args as any).name === 'string' &&
           typeof (args as any).role === 'string' &&
           Array.isArray((args as any).expertise);
  },
  expectedArgs: "{ name: string, role: string, expertise: string[] }"
};

// Fragment for custom agent instructions
interface CustomInstructionsArgs {
  content: string;
}

export const customInstructionsFragment: PromptFragment<CustomInstructionsArgs> = {
  id: "custom-instructions",
  priority: 15,
  template: ({ content }) => content,
  validateArgs: (args): args is CustomInstructionsArgs => {
    return typeof args === 'object' && 
           args !== null && 
           typeof (args as any).content === 'string';
  }
};

// Fragment for agent conversation context
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

// Fragment for agent next action options
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

// Fragment for agent response schema
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

// Fragment for expert feedback context
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

// Fragment for expert feedback task
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

// Fragment for expert feedback response schema
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

// Register all fragments
fragmentRegistry.register(agentIdentityFragment);
fragmentRegistry.register(customInstructionsFragment);
fragmentRegistry.register(agentConversationContextFragment);
fragmentRegistry.register(agentNextActionFragment);
fragmentRegistry.register(agentResponseSchemaFragment);
fragmentRegistry.register(expertFeedbackContextFragment);
fragmentRegistry.register(expertFeedbackTaskFragment);
fragmentRegistry.register(expertFeedbackResponseFragment);