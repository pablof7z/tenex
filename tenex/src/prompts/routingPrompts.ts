import { PromptBuilder } from "./core/PromptBuilder";

/**
 * Get the system prompt for general routing decisions
 */
export function getRoutingSystemPrompt(projectContext?: string): string {
  const builder = new PromptBuilder();
  return builder
    .add("routing-system-prompt", {
      role: "conversation routing",
      projectContext,
    })
    .build();
}

/**
 * Get the system prompt for phase transition decisions
 */
export function getPhaseTransitionSystemPrompt(): string {
  const builder = new PromptBuilder();
  return builder.add("phase-transition-system", {}).build();
}

/**
 * Get the system prompt for agent selection
 */
export function getAgentSelectionSystemPrompt(): string {
  const builder = new PromptBuilder();
  return builder.add("agent-selection-system", {}).build();
}

/**
 * Get the system prompt for fallback routing
 */
export function getFallbackRoutingSystemPrompt(): string {
  const builder = new PromptBuilder();
  return builder.add("fallback-routing-system", {}).build();
}
