/**
 * Agent-related types for the orchestration system
 */

export interface AgentRole {
    name: string;
    capabilities: AgentCapability[];
}

export enum AgentCapability {
    // Core capabilities
    CODE_EXECUTION = "code_execution",
    FILE_OPERATIONS = "file_operations",

    // Privileged capabilities
    FIND_AGENTS = "find_agents",
    UPDATE_SPECS = "update_specs",
    ORCHESTRATION = "orchestration",

    // Task capabilities
    DEBUGGING = "debugging",
    TESTING = "testing",
    DOCUMENTATION = "documentation",
    ARCHITECTURE = "architecture",
}

export interface AgentConfiguration {
    name: string;
    nsec: string;
    eventId?: string;
    role?: string;
    capabilities?: AgentCapability[];
    isPrimary?: boolean; // Indicates if this is the primary/orchestrator agent
}

export interface ProjectAgentsConfig {
    primary: string; // Name of the primary agent (replaces "default")
    agents: Record<string, AgentConfiguration>;
}
