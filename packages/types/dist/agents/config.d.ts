/**
 * Agent configuration types
 */
/**
 * Agent configuration entry in agents.json
 */
export interface AgentConfigEntry {
    nsec: string;
    file?: string;
}
/**
 * Legacy format: string (nsec) or new format: object
 */
export type LegacyAgentConfigEntry = string | AgentConfigEntry;
/**
 * agents.json structure
 */
export interface AgentsJson {
    [agentKey: string]: AgentConfigEntry;
}
/**
 * Legacy agents.json structure (for backward compatibility)
 */
export interface LegacyAgentsJson {
    [agentKey: string]: LegacyAgentConfigEntry;
}
/**
 * Agent signer result when getting/creating an agent
 */
export interface AgentSignerResult {
    signer: unknown;
    nsec: string;
    isNew: boolean;
    configFile?: string;
}
/**
 * Agent configuration metadata
 */
export interface AgentConfig {
    name: string;
    description?: string;
    role?: string;
    instructions?: string;
    systemPrompt?: string;
    version?: number;
}
//# sourceMappingURL=config.d.ts.map