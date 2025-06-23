import { getProjectContext } from "@/services";
import type { Agent } from "@/agents/types";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { DEFAULT_AGENT_LLM_CONFIG } from "@/llm/constants";

export interface ProjectAgentOptions {
  name?: string;
  role?: string;
  expertise?: string;
  instructions?: string;
  llmConfig?: string;
  tools?: string[];
}

/**
 * Creates a project agent configuration for the chat phase
 */
export function createProjectAgent(options: ProjectAgentOptions = {}): Agent {
  const projectCtx = getProjectContext();
  return {
    name: options.name || "Project",
    pubkey: projectCtx.signer.pubkey,
    signer: projectCtx.signer,
    role: options.role || "Requirements Analyst",
    expertise: options.expertise || "Understanding user needs and clarifying requirements",
    instructions:
      options.instructions ||
      "You are the project assistant helping to understand and clarify user requirements. " +
        "Ask clarifying questions when needed and help the user articulate their needs clearly.",
    llmConfig: options.llmConfig || DEFAULT_AGENT_LLM_CONFIG,
    tools: options.tools || [],
  };
}

/**
 * Creates a minimal project agent configuration (no instructions)
 */
export function createMinimalProjectAgent(
  options: Omit<ProjectAgentOptions, "instructions"> = {}
): Omit<Agent, "instructions"> {
  const projectCtx = getProjectContext();
  return {
    name: options.name || "Project",
    pubkey: projectCtx.signer.pubkey,
    signer: projectCtx.signer,
    role: options.role || "Requirements analyst",
    expertise: options.expertise || "Understanding user needs and clarifying requirements",
    llmConfig: options.llmConfig || DEFAULT_AGENT_LLM_CONFIG,
    tools: options.tools || [],
  };
}

/**
 * Creates an agent from a configuration object
 */
export function createAgentFromConfig(config: {
  name: string;
  role: string;
  expertise: string;
  instructions?: string;
  pubkey: string;
  signer: NDKPrivateKeySigner;
  llmConfig?: string;
  tools?: string[];
}): Agent {
  return {
    name: config.name,
    pubkey: config.pubkey,
    signer: config.signer,
    role: config.role,
    expertise: config.expertise,
    instructions: config.instructions,
    llmConfig: config.llmConfig || "default",
    tools: config.tools || [],
  };
}
