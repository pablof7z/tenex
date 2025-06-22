import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

// Execute phase prompt fragment
interface ExecutePhasePromptArgs {
  plan: string;
  instruction: string;
}

export const executePhasePromptFragment: PromptFragment<ExecutePhasePromptArgs> = {
  id: "execute-phase-prompt",
  priority: 10,
  template: ({ plan, instruction }) => {
    return `Current Plan:
${plan}

Instruction: ${instruction}`;
  },
};

// Plan phase prompt fragment
interface PlanPhasePromptArgs {
  context: string;
  instruction: string;
}

export const planPhasePromptFragment: PromptFragment<PlanPhasePromptArgs> = {
  id: "plan-phase-prompt",
  priority: 10,
  template: ({ context, instruction }) => {
    return `${context}

${instruction}`;
  },
};

// Plan task description fragment
interface PlanTaskDescriptionArgs {
  recentRequests: string;
}

export const planTaskDescriptionFragment: PromptFragment<PlanTaskDescriptionArgs> = {
  id: "plan-task-description",
  priority: 10,
  template: ({ recentRequests }) => {
    return `Based on the user's request: "${recentRequests}"

Create a detailed implementation plan that:
1. Addresses the specific requirements mentioned
2. Includes technical architecture and design decisions
3. Breaks down the work into clear implementation steps
4. Identifies any tools, libraries, or frameworks needed
5. Considers testing and quality assurance

Focus on being actionable and specific rather than asking questions.`;
  },
};

// Tool continuation prompt fragment
interface ToolContinuationPromptArgs {
  toolResults: Array<{
    toolName: string;
    success: boolean;
    output?: unknown;
    error?: string;
  }>;
}

export const toolContinuationPromptFragment: PromptFragment<ToolContinuationPromptArgs> = {
  id: "tool-continuation-prompt",
  priority: 10,
  template: ({ toolResults }) => {
    let prompt = "Based on the tool execution results:\n\n";

    for (const result of toolResults) {
      prompt += `**${result.toolName}**: `;
      if (result.success) {
        prompt += typeof result.output === "string"
          ? result.output
          : JSON.stringify(result.output, null, 2);
      } else {
        prompt += `Error: ${result.error}`;
      }
      prompt += "\n\n";
    }

    prompt += "\nPlease continue with your analysis or provide a final response. ";
    prompt += "If you need to use more tools, you can do so. ";
    prompt += "If you have all the information needed, provide your complete response.";

    return prompt;
  },
};

// Register all fragments
fragmentRegistry.register(executePhasePromptFragment);
fragmentRegistry.register(planPhasePromptFragment);
fragmentRegistry.register(planTaskDescriptionFragment);
fragmentRegistry.register(toolContinuationPromptFragment);