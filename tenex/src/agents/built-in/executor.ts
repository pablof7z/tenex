import { DEFAULT_AGENT_LLM_CONFIG } from "@/llm/constants";
import type { BuiltInAgentDefinition } from "../builtInAgents";

export const EXECUTOR_AGENT: BuiltInAgentDefinition = {
  name: "Executor",
  slug: "executer",
  role: "Executer of tasks",
  instructions: `You are an execution specialist.

You receive requests either from the Orchestrator or directly from users.
The 'message' parameter contains the task you need to accomplish.

Your role is to:
- Execute the implementation task described in the message using the claude_code tool. Provide this verbatim to claude_code in execute mode.
- When complete, use the 'yield_back' tool to return control
- Include a brief summary of what you accomplished in the response parameter`,
  llmConfig: DEFAULT_AGENT_LLM_CONFIG,
};
