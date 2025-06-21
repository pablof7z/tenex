/**
 * LLM Configuration types - Simple and clear
 */

import type { LLMProvider } from "../core/llm";

/**
 * A preset configuration for an LLM (what model to use and how)
 * Example: { provider: "openrouter", model: "google/gemini-2.5", temperature: 0.7 }
 */
export interface LLMPreset {
    provider: LLMProvider;
    model: string;
    enableCaching?: boolean;
    temperature?: number;
    maxTokens?: number;
}

/**
 * API credentials for connecting to an LLM provider
 * Example: { apiKey: "sk-...", baseUrl: "https://api.openai.com/v1" }
 */
export interface ProviderAuth {
    apiKey?: string;
    baseUrl?: string;
    headers?: Record<string, string>;
}

/**
 * The complete LLM settings as stored in llms.json
 * 
 * Example:
 * {
 *   presets: {
 *     "fast": { provider: "openrouter", model: "gpt-3.5-turbo" },
 *     "smart": { provider: "anthropic", model: "claude-3-opus" }
 *   },
 *   selection: {
 *     "default": "fast",
 *     "code-review": "smart"
 *   },
 *   auth: {
 *     "openrouter": { apiKey: "sk-..." },
 *     "anthropic": { apiKey: "sk-..." }
 *   }
 * }
 */
export interface LLMSettings {
    presets: Record<string, LLMPreset>;        // Named model configurations
    selection: Record<string, string>;         // Which preset to use when
    auth: Record<string, ProviderAuth>;        // Provider API keys
}

// Backward compatibility aliases (deprecated)
export type LLMConfig = LLMPreset;
export type LLMCredentials = ProviderAuth;
export type LLMFileConfiguration = LLMSettings;
export type LLMConfigurationRegistry = Record<string, LLMPreset>;
export type LLMConfigurationMapping = Record<string, string>;
export type LLMProviderCredentials = Record<string, ProviderAuth>;

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
         * Configuration for agents
         */
        agents?: string;

        /**
         * Configuration for agent routing
         */
        agentRouting?: string;

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