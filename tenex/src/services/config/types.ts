import { z } from "zod";

/**
 * Unified configuration types for TENEX
 * All configuration files use the same schemas for both global and project contexts
 */

// =====================================================================================
// MAIN CONFIG SCHEMA (config.json)
// =====================================================================================

export interface TenexConfig {
    // Global fields
    whitelistedPubkeys?: string[];

    // Project fields (optional for global config)
    description?: string;
    repoUrl?: string;
    projectNaddr?: string;
    paths?: {
        inventory?: string;
    };
}

export const TenexConfigSchema = z.object({
    whitelistedPubkeys: z.array(z.string()).optional(),
    description: z.string().optional(),
    repoUrl: z.string().optional(),
    projectNaddr: z.string().optional(),
    paths: z
        .object({
            inventory: z.string().optional(),
        })
        .optional(),
});

// =====================================================================================
// AGENTS SCHEMA (agents.json)
// =====================================================================================

export interface TenexAgents {
    [agentSlug: string]: {
        nsec: string;
        file: string;
        eventId?: string;
        pmAgent?: boolean;
    };
}

export const TenexAgentsSchema = z.record(
    z.object({
        nsec: z.string(),
        file: z.string(),
        eventId: z.string().optional(),
        pmAgent: z.boolean().optional(),
    })
);

// =====================================================================================
// LLM SCHEMA (llms.json)
// =====================================================================================

export interface TenexLLMs {
    configurations: {
        [namedConfig: string]: {
            provider: string;
            model: string;
            temperature?: number;
            maxTokens?: number;
            enableCaching?: boolean;
        };
    };
    defaults?: {
        agents?: string;
        [agentSlug: string]: string | undefined;
    };
    credentials: {
        [namedCredential: string]: {
            apiKey?: string;
            baseUrl?: string;
            headers?: Record<string, string>;
        };
    };
}

export const TenexLLMsSchema = z.object({
    configurations: z.record(
        z.object({
            provider: z.string(),
            model: z.string(),
            temperature: z.number().optional(),
            maxTokens: z.number().optional(),
            enableCaching: z.boolean().optional(),
        })
    ),
    defaults: z.record(z.string()).optional().default({}),
    credentials: z.record(
        z.object({
            apiKey: z.string().optional(),
            baseUrl: z.string().optional(),
            headers: z.record(z.string()).optional(),
        })
    ),
});

// =====================================================================================
// LOADED CONFIGURATION STATE
// =====================================================================================

export interface LoadedConfig {
    config: TenexConfig;
    agents: TenexAgents;
    llms: TenexLLMs;
}

// =====================================================================================
// HELPER TYPES
// =====================================================================================

export type ConfigFile = "config.json" | "agents.json" | "llms.json";

export interface ConfigPaths {
    global: string;
    project?: string;
}
