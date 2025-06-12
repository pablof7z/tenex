import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { AgentProfile, AgentSignerResult, AgentsJson } from "./types.js";
/**
 * Convert agent name to kebab-case for use as key in agents.json
 * Examples: "Christ" -> "christ", "Hello World" -> "hello-world"
 */
export declare function toKebabCase(name: string): string;
/**
 * Load agents configuration from a file
 * Handles both legacy (string) and new (object) formats
 */
export declare function loadAgentsConfig(configPath: string): Promise<AgentsJson>;
/**
 * Save agents configuration to a file
 */
export declare function saveAgentsConfig(configPath: string, agents: AgentsJson): Promise<void>;
/**
 * Generate avatar URL for an agent
 */
export declare function generateAgentAvatarUrl(displayName: string): string;
/**
 * Create agent profile data
 */
export declare function createAgentProfile(agentName: string, projectName: string, isDefault?: boolean): AgentProfile;
/**
 * Publish agent profile to Nostr
 */
export declare function publishAgentProfile(nsec: string, agentName: string, projectName: string, isDefault?: boolean): Promise<void>;
/**
 * Publish agent request event (kind 3199) to request human acknowledgment
 */
export declare function publishAgentRequest(agentSigner: NDKPrivateKeySigner, agentName: string, projectNaddr: string, projectAuthor: string, agentEventFile?: string): Promise<void>;
/**
 * Get or create an agent signer
 */
export declare function getOrCreateAgentSigner(projectPath: string, agentSlug?: string): Promise<AgentSignerResult>;
/**
 * Update or add an agent to agents.json
 */
export declare function updateAgentConfig(projectPath: string, agentName: string, nsec: string, configFile?: string): Promise<void>;
/**
 * Fetch and save agent definitions from Nostr
 */
export declare function fetchAndSaveAgentDefinitions(agentEventIds: string[], tenexDir: string, agentsConfig: AgentsJson): Promise<void>;
