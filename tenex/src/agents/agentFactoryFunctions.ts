import type { ProjectContext } from "@/runtime";
import type { Agent } from "@/types/agent";
import type { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";

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
export function createProjectAgent(
  projectContext: ProjectContext,
  options: ProjectAgentOptions = {}
): Agent {
  return {
    name: options.name || "Project",
    pubkey: projectContext.projectSigner.pubkey,
    signer: projectContext.projectSigner,
    role: options.role || "Requirements Analyst",
    expertise: options.expertise || "Understanding user needs and clarifying requirements",
    instructions:
      options.instructions ||
      "You are the project assistant helping to understand and clarify user requirements. " +
        "Ask clarifying questions when needed and help the user articulate their needs clearly.",
    llmConfig: options.llmConfig || "default",
    tools: options.tools || [],
  };
}

/**
 * Creates a minimal project agent configuration (no instructions)
 */
export function createMinimalProjectAgent(
  projectContext: ProjectContext,
  options: Omit<ProjectAgentOptions, "instructions"> = {}
): Omit<Agent, "instructions"> {
  return {
    name: options.name || "Project",
    pubkey: projectContext.projectSigner.pubkey,
    signer: projectContext.projectSigner,
    role: options.role || "Requirements analyst",
    expertise: options.expertise || "Understanding user needs and clarifying requirements",
    llmConfig: options.llmConfig || "default",
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
