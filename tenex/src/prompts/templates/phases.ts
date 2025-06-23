import type { Conversation } from "@/conversations/types";
import type { AgentSummary } from "@/routing/types";
import { PromptBuilder } from "../core/PromptBuilder";
import "../fragments/phase-prompts"; // Ensure fragments are registered

export function buildChatPhasePrompt(conversation: Conversation): string {
  const builder = new PromptBuilder();

  return builder
    .add("base-context", {
      content: "You are the project assistant helping the user get their work done efficiently.",
    })
    .add("phase-conversation-context", {
      title: conversation.title,
      summary: conversation.metadata.summary,
    })
    .add("chat-phase-guidelines", {})
    .add("phase-next-actions", {
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
    .add("plan-phase-task", {
      requirements: requirements,
    })
    .build();
}

export function buildExecutePhasePrompt(conversation: Conversation, plan: string): string {
  const builder = new PromptBuilder();

  return builder
    .add("base-context", {
      content: "You are implementing the approved plan.",
    })
    .add("phase-conversation-context", {
      title: conversation.title,
      branch: conversation.metadata.branch || "feature-branch",
    })
    .add("execute-phase-task", {
      plan: plan,
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
    .add("phase-conversation-context", {
      title: conversation.title,
      branch: conversation.metadata.branch,
    })
    .add("review-phase-task", {})
    .add("agent-list", {
      agents: agents.filter((a) => a.role.includes("reviewer") || a.role.includes("expert")),
      format: "simple",
    })
    .add("phase-next-actions", {
      availableActions: [
        "handoff: Request review from specific expert",
        "execute_tool: Run tests or quality checks",
        "phase_transition: Return to execute if issues found",
        "complete: Mark as ready for merge",
      ],
    })
    .build();
}
