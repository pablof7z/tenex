import type { Agent, AgentContext } from "@/agents/types";
import type { AgentSummary } from "@/routing/types";
import { PromptBuilder } from "../core/PromptBuilder";
import "../fragments/agent-prompts"; // Ensure fragments are registered

export function buildAgentPrompt(
  agent: Agent,
  context: AgentContext,
  tools: Array<{ name: string; description: string }>
): string {
  const builder = new PromptBuilder();

  return builder
    .add("agent-identity", {
      name: agent.name,
      role: agent.role,
      expertise: agent.expertise,
    })
    .add(
      "custom-instructions",
      {
        content: agent.instructions || "",
      },
      (args) => !!args.content
    )
    .add("agent-conversation-context", {
      conversationTitle: context.conversation.title,
      phase: context.phase,
      currentTask: context.incomingEvent.content,
    })
    .add("tool-list", { tools })
    .add("agent-list", {
      agents: context.availableAgents,
      format: "simple",
    })
    .add("agent-next-action", {
      availableActions: [
        "handoff: Transfer to another agent (specify pubkey)",
        "phase_transition: Move to a different phase",
        "complete: Task is complete",
        "human_input: Need input from the user",
        "continue: Continue working on the task",
      ],
    })
    .add("agent-response-schema", {})
    .build();
}

export function buildExpertFeedbackPrompt(
  expert: Agent,
  workToReview: string,
  context: string
): string {
  const builder = new PromptBuilder();

  return builder
    .add("agent-identity", {
      name: expert.name,
      role: expert.role,
      expertise: expert.expertise,
    })
    .add("base-context", {
      content: "You are providing expert feedback on the following work.",
    })
    .add("expert-feedback-context", {
      context: context,
      workToReview: workToReview,
    })
    .add("expert-feedback-task", {})
    .add("expert-feedback-response", {})
    .build();
}
