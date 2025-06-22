import type { Agent, AgentContext } from "@/agents/types";
import type { AgentSummary } from "@/routing/types";
import { PromptBuilder } from "../core/PromptBuilder";

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
    .add("conversation-context", {
      content: `Conversation: ${context.conversation.title}
Phase: ${context.phase}
Current task: ${context.incomingEvent.content}`,
    })
    .add("tool-list", { tools })
    .add("agent-list", {
      agents: context.availableAgents,
      format: "simple",
    })
    .add("next-action", {
      availableActions: [
        "handoff: Transfer to another agent (specify pubkey)",
        "phase_transition: Move to a different phase",
        "complete: Task is complete",
        "human_input: Need input from the user",
        "continue: Continue working on the task",
      ],
    })
    .add("json-response", {
      schema: `{
  "response": "your response to the task",
  "toolCalls": [{"tool": "name", "args": {}}], // optional
  "nextAction": {
    "type": "handoff|phase_transition|complete|human_input|continue",
    "target": "pubkey or phase name", // if applicable
    "reasoning": "why this action"
  }
}`,
    })
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
    .add("review-context", {
      content: `Context: ${context}`,
    })
    .add("work-to-review", {
      content: `Work to review:\n${workToReview}`,
    })
    .add("task-description", {
      content: `Provide feedback focusing on:
1. Technical correctness within your expertise
2. Best practices and standards
3. Potential issues or improvements
4. Whether this meets the requirements

Be constructive and specific.`,
    })
    .add("json-response", {
      schema: `{
  "feedback": "your detailed feedback",
  "confidence": 0.0-1.0,
  "issues": ["list of specific issues found"], // optional
  "suggestions": ["list of improvements"], // optional
  "approved": true|false
}`,
    })
    .build();
}
