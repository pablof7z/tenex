/**
 * Agent configuration types
 */

export interface AgentConfig {
    name: string;
    role: string;
    expertise: string;
    instructions: string;
    llmConfig?: string;
    tools?: string[];
}

export interface AgentsJson {
    agents: Record<string, AgentConfig>;
}

export interface TrackedAgentConfig extends AgentConfig {
    source: "global" | "project";
}

export interface TrackedAgentsJson {
    agents: Record<string, TrackedAgentConfig>;
}

export type AgentProfile = "junior" | "senior" | "architect" | "specialist";

export interface ConfigurationLoadOptions {
    includeGlobal?: boolean;
    includeProject?: boolean;
    skipGlobal?: boolean;
}