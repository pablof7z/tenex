/**
 * Agent configuration types
 */

export interface AgentReference {
    nsec: string;
    file: string;
    eventId?: string;
}

export interface AgentsJson {
    [agentSlug: string]: AgentReference;
}

export interface AgentDefinition {
    name: string;
    role: string;
    expertise: string;
    instructions: string;
    llmConfig?: string;
    tools?: string[];
}

export interface TrackedAgentReference extends AgentReference {
    source: "global" | "project";
}

export interface TrackedAgentsJson {
    [agentSlug: string]: TrackedAgentReference;
}

export type AgentProfile = "junior" | "senior" | "architect" | "specialist";

export interface ConfigurationLoadOptions {
    includeGlobal?: boolean;
    includeProject?: boolean;
    skipGlobal?: boolean;
}