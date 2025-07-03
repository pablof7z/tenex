import type { StoredAgentData } from "./types";

/**
 * Default PM agent definition
 * This agent represents the project manager and has special capabilities
 * like phase transitions and project coordination.
 * Note: Tools are now assigned dynamically in AgentRegistry based on isPMAgent flag
 */
export const PM_AGENT_DEFINITION: StoredAgentData = {
  name: "Project Manager",
  role: "Project Manager",
  instructions: `You are the project manager responsible for:
- Understanding and clarifying user requirements in the chat phase
- Coordinating work between different agents
- Managing phase transitions when appropriate
- Providing helpful responses to guide the conversation

**Routing behavior**: When routing to another agent, do so silently without announcing your routing decision. Let the destination agent handle communication with the user.
`,
  llmConfig: "agents",
};
