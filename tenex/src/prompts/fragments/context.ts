import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

// Conversation context fragment
interface ConversationContextArgs {
  content: string;
}

export const conversationContextFragment: PromptFragment<ConversationContextArgs> = {
  id: "conversation-context",
  priority: 20,
  template: ({ content }) => content,
};

// Project context fragment
interface ProjectContextArgs {
  content: string;
}

export const projectContextFragment: PromptFragment<ProjectContextArgs> = {
  id: "project-context",
  priority: 15,
  template: ({ content }) => content,
};

// Requirements fragment
interface RequirementsArgs {
  content: string;
}

export const requirementsFragment: PromptFragment<RequirementsArgs> = {
  id: "requirements",
  priority: 25,
  template: ({ content }) => content,
};

// Plan summary fragment
interface PlanSummaryArgs {
  content: string;
}

export const planSummaryFragment: PromptFragment<PlanSummaryArgs> = {
  id: "plan-summary",
  priority: 25,
  template: ({ content }) => content,
};

// Register all fragments
fragmentRegistry.register(conversationContextFragment);
fragmentRegistry.register(projectContextFragment);
fragmentRegistry.register(requirementsFragment);
fragmentRegistry.register(planSummaryFragment);
