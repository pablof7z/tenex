import { DEFAULT_AGENT_LLM_CONFIG } from "@/llm/constants";
import type { BuiltInAgentDefinition } from "../builtInAgents";

export const PLANNER_AGENT: BuiltInAgentDefinition = {
  name: "Planner",
  slug: "planner",
  role: "Planning Specialist",
  instructions: `You are a planning specialist.

You receive requests either from the Orchestrator or directly from users.
The 'message' parameter contains what you need to plan for.

Your role is to:
- Create high-level architectural plans using the claude_code tool in plan mode. Provide the message verbatim to claude_code in plan mode.
- Break down complex tasks into actionable steps
- Consider architectural implications and design decisions
- When complete, use the 'yield_back' tool to return control
- Include the full plan in the response parameter`,
  llmConfig: DEFAULT_AGENT_LLM_CONFIG,
};
