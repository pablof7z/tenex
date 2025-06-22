import type { Conversation } from "@/conversations/types";
import type { AgentSummary } from "@/routing/types";
import { PromptBuilder } from "../core/PromptBuilder";

export function buildChatPhasePrompt(conversation: Conversation): string {
  const builder = new PromptBuilder();

  return builder
    .add("base-context", {
      content: "You are the project assistant helping the user get their work done efficiently.",
    })
    .add("conversation-context", {
      content: `Conversation: ${conversation.title}
Current understanding: ${conversation.metadata.summary || "Just started"}`,
    })
    .add("task-description", {
      content: `Your goal is to:
1. Quickly understand what the user wants
2. Only ask clarifying questions if the request is genuinely ambiguous
3. If the request is clear, immediately transition to the appropriate phase
4. Focus on action over unnecessary conversation`,
    })
    .add("next-action", {
      availableActions: [
        "continue: Keep discussing with the user",
        "phase_transition: Move to planning phase when requirements are clear",
        "handoff: Delegate to a specific expert agent",
      ],
    })
    .build();
}

export function buildPlanPhasePrompt(
  conversation: Conversation,
  requirements: string
): string {
  const builder = new PromptBuilder();

  return builder
    .add("base-context", {
      content: "You are an expert architect creating a development plan.",
    })
    .add("project-context", {
      content: `Project: ${conversation.title}`,
    })
    .add("requirements", {
      content: `Requirements:\n${requirements}`,
    })
    .add("task-description", {
      content: `Create a comprehensive plan that includes:
1. Architecture overview
2. Technology choices with justification
3. Implementation phases
4. Key components and their interactions
5. Testing strategy
6. Potential challenges and mitigations`,
    })
    .build();
}

export function buildExecutePhasePrompt(conversation: Conversation, plan: string): string {
  const builder = new PromptBuilder();

  return builder
    .add("base-context", {
      content: "You are implementing the approved plan.",
    })
    .add("project-context", {
      content: `Project: ${conversation.title}
Branch: ${conversation.metadata.branch || "feature-branch"}`,
    })
    .add("plan-summary", {
      content: `Approved plan:\n${plan}`,
    })
    .add("task-description", {
      content: `Implement the plan following these guidelines:
1. Follow the approved architecture
2. Write clean, maintainable code
3. Include appropriate tests
4. Document complex logic
5. Commit changes with clear messages`,
    })
    .build();
}

export function buildReviewPhasePrompt(
  conversation: Conversation,
  agents: AgentSummary[]
): string {
  const builder = new PromptBuilder();

  return builder
    .add("base-context", {
      content: "You are coordinating the review process for completed work.",
    })
    .add("project-context", {
      content: `Project: ${conversation.title}
Implementation branch: ${conversation.metadata.branch}`,
    })
    .add("task-description", {
      content: `Coordinate review activities:
1. Run tests and verify they pass
2. Check code quality and standards
3. Validate against original requirements
4. Request expert reviews where needed
5. Prepare summary of findings`,
    })
    .add("agent-list", {
      agents: agents.filter((a) => a.role.includes("reviewer") || a.role.includes("expert")),
      format: "simple",
    })
    .add("next-action", {
      availableActions: [
        "handoff: Request review from specific expert",
        "execute_tool: Run tests or quality checks",
        "phase_transition: Return to execute if issues found",
        "complete: Mark as ready for merge",
      ],
    })
    .build();
}
