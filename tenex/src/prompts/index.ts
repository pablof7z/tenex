/**
 * Centralized exports for all TENEX system prompts
 */

import { BASE_AGENT_PROMPT } from "./base-agent";
import { SINGLE_AGENT_PROMPT } from "./single-agent";
import { TEAM_LEAD_PROMPT } from "./team-lead";
import { TEAM_ORCHESTRATOR_PROMPT } from "./team-orchestrator";
import { TOOL_INSTRUCTIONS_PROMPT } from "./tool-instructions";

export { BASE_AGENT_PROMPT } from "./base-agent";
export { TEAM_LEAD_PROMPT } from "./team-lead";
export { TEAM_ORCHESTRATOR_PROMPT } from "./team-orchestrator";
export { TOOL_INSTRUCTIONS_PROMPT } from "./tool-instructions";
export { SINGLE_AGENT_PROMPT } from "./single-agent";
export { SystemPromptComposer, type PromptContext } from "./composer";
export { AGENT_CATALOG_PROMPT } from "./agent-catalog";

// Convenience object for backwards compatibility
export const SYSTEM_PROMPTS = {
  BASE_AGENT: BASE_AGENT_PROMPT,
  TEAM_LEAD: TEAM_LEAD_PROMPT,
  TEAM_ORCHESTRATOR: TEAM_ORCHESTRATOR_PROMPT,
  TOOL_INSTRUCTIONS: TOOL_INSTRUCTIONS_PROMPT,
  SINGLE_AGENT: SINGLE_AGENT_PROMPT,
} as const;
