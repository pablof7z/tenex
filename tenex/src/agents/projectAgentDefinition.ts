import type { StoredAgentData } from "./types";
import { getDefaultToolsForAgent } from "./constants";

/**
 * Default PM agent definition
 * This agent represents the project manager and has special capabilities
 * like phase transitions and project coordination.
 */
export const PM_AGENT_DEFINITION: StoredAgentData = {
    name: "Project Manager",
    role: "Project Manager",
    instructions: `You are the project manager responsible for:
- Understanding and clarifying user requirements in the chat phase
- Coordinating work between different agents
- Managing phase transitions when appropriate
- Providing helpful responses to guide the conversation
`,
    tools: getDefaultToolsForAgent(true), // PM agent gets PM tools
    llmConfig: "agents",
};
