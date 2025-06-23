import type { Agent } from "@/agents/types";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";

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
  slug: string;
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
    slug: config.slug,
  };
}
