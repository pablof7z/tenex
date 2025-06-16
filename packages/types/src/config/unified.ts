/**
 * Unified configuration types for TENEX
 * 
 * These types define the structure for both global and project configurations,
 * ensuring consistency across the entire system.
 */

import type { LLMConfig } from "../llm/config";
import type { TelemetryConfig } from "../telemetry/config";
import type { AgentsJson } from "../agents/config";

/**
 * LLM provider credentials for authentication
 */
export interface LLMCredentials {
    apiKey?: string;
    baseUrl?: string;
    headers?: Record<string, string>;
}

/**
 * Unified LLM configuration structure
 * Used in both global (~/.tenex/llms.json) and project (.tenex/llms.json)
 */
export interface UnifiedLLMConfig {
    /**
     * Named LLM configurations
     */
    configurations: {
        [name: string]: LLMConfig;
    };
    
    /**
     * Default configurations for different contexts
     */
    defaults: {
        /**
         * Default configuration for general use
         */
        default?: string;
        
        /**
         * Configuration for orchestrator LLM
         */
        orchestrator?: string;
        
        /**
         * Agent-specific default configurations
         */
        [agentName: string]: string | undefined;
    };
    
    /**
     * Provider credentials (only stored in global config)
     */
    credentials?: {
        [provider: string]: LLMCredentials;
    };
}

/**
 * Project-specific configuration stored in .tenex/config.json
 * (formerly metadata.json)
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
     * Telemetry configuration
     */
    telemetry?: TelemetryConfig;
}

/**
 * Global configuration stored in ~/.tenex/config.json
 */
export interface GlobalConfig {
    /**
     * Whitelisted pubkeys for daemon monitoring
     */
    whitelistedPubkeys?: string[];
    
    /**
     * Global telemetry configuration
     */
    telemetry?: TelemetryConfig;
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
     * LLM configurations
     */
    llms: UnifiedLLMConfig;
    
    /**
     * Agent configurations (project-only)
     */
    agents?: AgentsJson;
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
     * LLM configuration file (llms.json)
     */
    LLMS: "llms.json",
    
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