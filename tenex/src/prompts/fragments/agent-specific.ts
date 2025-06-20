import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

// Agent identity fragment - for when an agent introduces itself
interface AgentIdentityArgs {
  name: string;
  role: string;
  expertise: string;
}

export const agentIdentityFragment: PromptFragment<AgentIdentityArgs> = {
  id: "agent-identity",
  priority: 5,
  template: ({ name, role, expertise }) =>
    `You are ${name}, a ${role}.\nYour expertise: ${expertise}`,
};

// Custom instructions fragment
interface CustomInstructionsArgs {
  content: string;
}

export const customInstructionsFragment: PromptFragment<CustomInstructionsArgs> = {
  id: "custom-instructions",
  priority: 8,
  template: ({ content }) => `Additional instructions:\n${content}`,
};

// Review context fragment
interface ReviewContextArgs {
  content: string;
}

export const reviewContextFragment: PromptFragment<ReviewContextArgs> = {
  id: "review-context",
  priority: 22,
  template: ({ content }) => content,
};

// Work to review fragment
interface WorkToReviewArgs {
  content: string;
}

export const workToReviewFragment: PromptFragment<WorkToReviewArgs> = {
  id: "work-to-review",
  priority: 28,
  template: ({ content }) => content,
};

// Register all fragments
fragmentRegistry.register(agentIdentityFragment);
fragmentRegistry.register(customInstructionsFragment);
fragmentRegistry.register(reviewContextFragment);
fragmentRegistry.register(workToReviewFragment);
