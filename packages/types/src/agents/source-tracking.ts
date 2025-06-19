/**
 * Source tracking for agent configurations
 */

import type { AgentConfigEntry } from "./config";

/**
 * Agent configuration with source tracking
 */
export interface TrackedAgentConfigEntry extends AgentConfigEntry {
    /**
     * Source of this configuration ('global' or 'project')
     */
    _source: "global" | "project";

    /**
     * Base path where this configuration was loaded from
     */
    _basePath: string;
}

/**
 * Tracked agents configuration
 */
export interface TrackedAgentsJson {
    [agentKey: string]: TrackedAgentConfigEntry;
}

/**
 * Configuration loading options
 */
export interface ConfigurationLoadOptions {
    /**
     * Skip loading global configurations
     */
    skipGlobal?: boolean;
}
