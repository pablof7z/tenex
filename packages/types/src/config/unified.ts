/**
 * Unified configuration types for TENEX
 *
 * These types define the structure for both global and project configurations,
 * ensuring consistency across the entire system.
 */

import type { AgentsJson, TrackedAgentsJson } from "../agents";
import type { LLMSettings } from "./llm";


/**
 * Project-specific configuration stored in .tenex/config.json
 */
export interface ProjectConfig {
    /**
     * Project title
     */
    title: string;

    /**
     * Project description
     */
    description?: string;

    /**
     * Repository URL
     */
    repoUrl?: string;

    /**
     * Project Nostr address
     */
    projectNaddr: string;

    /**
     * Project nsec (private key)
     */
    nsec?: string;

    /**
     * Project hashtags/topics
     */
    hashtags?: string[];

    /**
     * Creation timestamp
     */
    createdAt?: number;

    /**
     * Last update timestamp
     */
    updatedAt?: number;

    /**
     * Whitelisted pubkeys for this project
     */
    whitelistedPubkeys?: string[];

    /**
     * Path configurations
     */
    paths?: {
        /**
         * Path to inventory file (relative to project root)
         */
        inventory?: string;
    };
}

/**
 * Global configuration stored in ~/.tenex/config.json
 */
export interface GlobalConfig {
    /**
     * Whitelisted pubkeys for daemon monitoring
     */
    whitelistedPubkeys?: string[];
}

/**
 * Combined configuration structure for runtime use
 */
export interface TenexConfiguration {
    /**
     * Core configuration (project or global)
     */
    config: ProjectConfig | GlobalConfig;

    /**
     * LLM settings (presets, selection, auth)
     */
    llms?: LLMSettings;

    /**
     * Agent configurations (with source tracking when loaded)
     */
    agents?: AgentsJson | TrackedAgentsJson;
}

/**
 * Configuration paths
 */
export const CONFIG_PATHS = {
    /**
     * Configuration file (config.json)
     */
    CONFIG: "config.json",


    /**
     * Agents configuration file (agents.json)
     */
    AGENTS: "agents.json",

    /**
     * TENEX directory name
     */
    TENEX_DIR: ".tenex",
} as const;

/**
 * Type guard to check if config is a project config
 */
export function isProjectConfig(config: ProjectConfig | GlobalConfig): config is ProjectConfig {
    return "projectNaddr" in config && "title" in config;
}

/**
 * Type guard to check if config is a global config
 */
export function isGlobalConfig(config: ProjectConfig | GlobalConfig): config is GlobalConfig {
    return !isProjectConfig(config);
}
