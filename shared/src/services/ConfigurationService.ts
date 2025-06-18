import os from "node:os";
import path from "node:path";
import { fileExists, readJsonFile, writeJsonFile } from "@tenex/shared/fs";
import { logger } from "@tenex/shared/logger";
import type { AgentsJson } from "@tenex/types/agents";
import type {
    GlobalConfig,
    ProjectConfig,
    TenexConfiguration,
    UnifiedLLMConfig,
} from "@tenex/types/config";
import type { LLMConfig } from "@tenex/types/llm";
import { z } from "zod";

/**
 * Validation schemas for configuration files
 */

// LLM provider schemas
const AnthropicConfigSchema = z.object({
    provider: z.literal("anthropic"),
    model: z.string(),
    apiKey: z.string().optional(),
    baseURL: z.string().optional(),
    temperature: z.number().optional(),
    maxTokens: z.number().optional(),
    enableCaching: z.boolean().optional(),
    contextWindowSize: z.number().optional(),
    anthropicVersion: z.string().optional(),
    anthropicBeta: z.array(z.string()).optional(),
});

const OpenAIConfigSchema = z.object({
    provider: z.literal("openai"),
    model: z.string(),
    apiKey: z.string().optional(),
    baseURL: z.string().optional(),
    temperature: z.number().optional(),
    maxTokens: z.number().optional(),
    enableCaching: z.boolean().optional(),
    contextWindowSize: z.number().optional(),
    responseFormat: z.object({ type: z.enum(["text", "json_object"]) }).optional(),
});

const OpenRouterConfigSchema = z.object({
    provider: z.literal("openrouter"),
    model: z.string(),
    apiKey: z.string().optional(),
    baseURL: z.string().optional(),
    temperature: z.number().optional(),
    maxTokens: z.number().optional(),
    enableCaching: z.boolean().optional(),
    contextWindowSize: z.number().optional(),
    openrouterBeta: z.boolean().optional(),
});

const GoogleConfigSchema = z.object({
    provider: z.literal("google"),
    model: z.string(),
    apiKey: z.string().optional(),
    baseURL: z.string().optional(),
    temperature: z.number().optional(),
    maxTokens: z.number().optional(),
    enableCaching: z.boolean().optional(),
    contextWindowSize: z.number().optional(),
});

const GroqConfigSchema = z.object({
    provider: z.literal("groq"),
    model: z.string(),
    apiKey: z.string().optional(),
    baseURL: z.string().optional(),
    temperature: z.number().optional(),
    maxTokens: z.number().optional(),
    enableCaching: z.boolean().optional(),
    contextWindowSize: z.number().optional(),
});

const DeepSeekConfigSchema = z.object({
    provider: z.literal("deepseek"),
    model: z.string(),
    apiKey: z.string().optional(),
    baseURL: z.string().optional(),
    temperature: z.number().optional(),
    maxTokens: z.number().optional(),
    enableCaching: z.boolean().optional(),
    contextWindowSize: z.number().optional(),
});

const OllamaConfigSchema = z.object({
    provider: z.literal("ollama"),
    model: z.string(),
    apiKey: z.string().optional(),
    baseURL: z.string().optional(),
    temperature: z.number().optional(),
    maxTokens: z.number().optional(),
    enableCaching: z.boolean().optional(),
    contextWindowSize: z.number().optional(),
});

const LLMConfigSchema = z.union([
    AnthropicConfigSchema,
    OpenAIConfigSchema,
    OpenRouterConfigSchema,
    GoogleConfigSchema,
    GroqConfigSchema,
    DeepSeekConfigSchema,
    OllamaConfigSchema,
]);

// Credentials schema
const LLMCredentialsSchema = z.object({
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    headers: z.record(z.string()).optional(),
});

// Unified LLM config schema
const UnifiedLLMConfigSchema = z.object({
    configurations: z.record(LLMConfigSchema),
    defaults: z.record(z.string()),
    credentials: z.record(LLMCredentialsSchema).optional(),
});

// Agent config schema
const AgentConfigEntrySchema = z.object({
    nsec: z.string(),
    file: z.string().optional(),
});

const AgentsJsonSchema = z.record(AgentConfigEntrySchema);

// Project config schema
const ProjectConfigSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    repoUrl: z.string().optional(),
    projectNaddr: z.string(),
    nsec: z.string().optional(),
    hashtags: z.array(z.string()).optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
    whitelistedPubkeys: z.array(z.string()).optional(),
});

// Global config schema
const GlobalConfigSchema = z.object({
    whitelistedPubkeys: z.array(z.string()).optional(),
});

/**
 * Configuration cache entry
 */
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    filePath: string;
}

/**
 * Centralized configuration service for TENEX
 * Handles loading, caching, validation, and saving of configuration files
 * for both global and project-specific configurations
 */
export class ConfigurationService {
    private cache = new Map<string, CacheEntry<unknown>>();
    private readonly cacheTTL = 5000; // 5 seconds cache TTL

    /**
     * Get the path to the global TENEX directory
     */
    private getGlobalPath(): string {
        return path.join(os.homedir(), ".tenex");
    }

    /**
     * Get the path to a project's .tenex directory
     */
    private getProjectPath(projectPath: string): string {
        return path.join(projectPath, ".tenex");
    }

    /**
     * Load the complete configuration for a context (global or project)
     */
    async loadConfiguration(contextPath: string, isGlobal = false): Promise<TenexConfiguration> {
        const basePath = isGlobal ? this.getGlobalPath() : this.getProjectPath(contextPath);

        // Load config.json
        const config = isGlobal
            ? await this.loadGlobalConfig(basePath)
            : await this.loadProjectConfig(basePath);

        // Load llms.json
        const llms = await this.loadLLMConfig(basePath);

        // Load agents.json (project only, optional)
        let agents: AgentsJson | undefined;
        if (!isGlobal) {
            const agentsPath = path.join(basePath, "agents.json");
            if (await fileExists(agentsPath)) {
                agents = await this.loadAgentsConfig(basePath);
            }
        }

        return {
            config,
            llms,
            agents,
        };
    }

    /**
     * Save the complete configuration for a context (global or project)
     */
    async saveConfiguration(
        contextPath: string,
        configuration: TenexConfiguration,
        isGlobal = false
    ): Promise<void> {
        const basePath = isGlobal ? this.getGlobalPath() : this.getProjectPath(contextPath);

        // Save config.json
        if (isGlobal) {
            await this.saveGlobalConfig(basePath, configuration.config as GlobalConfig);
        } else {
            await this.saveProjectConfig(basePath, configuration.config as ProjectConfig);
        }

        // Save llms.json
        await this.saveLLMConfig(basePath, configuration.llms);

        // Save agents.json (project only, if provided)
        if (!isGlobal && configuration.agents) {
            await this.saveAgentsConfig(basePath, configuration.agents);
        }
    }

    /**
     * Load global config.json
     */
    async loadGlobalConfig(basePath: string): Promise<GlobalConfig> {
        const filePath = path.join(basePath, "config.json");
        return this.loadConfig(filePath, GlobalConfigSchema, {});
    }

    /**
     * Save global config.json
     */
    async saveGlobalConfig(basePath: string, config: GlobalConfig): Promise<void> {
        const filePath = path.join(basePath, "config.json");
        await this.saveConfig(filePath, config, GlobalConfigSchema);
    }

    /**
     * Load project config.json
     */
    async loadProjectConfig(basePath: string): Promise<ProjectConfig> {
        const filePath = path.join(basePath, "config.json");
        return this.loadConfig(filePath, ProjectConfigSchema);
    }

    /**
     * Save project config.json
     */
    async saveProjectConfig(basePath: string, config: ProjectConfig): Promise<void> {
        const filePath = path.join(basePath, "config.json");
        await this.saveConfig(filePath, config, ProjectConfigSchema);
    }

    /**
     * Load llms.json configuration
     */
    async loadLLMConfig(basePath: string): Promise<UnifiedLLMConfig> {
        const filePath = path.join(basePath, "llms.json");
        return this.loadConfig(filePath, UnifiedLLMConfigSchema, {
            configurations: {},
            defaults: {},
        });
    }

    /**
     * Save llms.json configuration
     */
    async saveLLMConfig(basePath: string, config: UnifiedLLMConfig): Promise<void> {
        const filePath = path.join(basePath, "llms.json");
        await this.saveConfig(filePath, config, UnifiedLLMConfigSchema);
    }

    /**
     * Load agents.json configuration
     */
    async loadAgentsConfig(basePath: string): Promise<AgentsJson> {
        const filePath = path.join(basePath, "agents.json");
        return this.loadConfig(filePath, AgentsJsonSchema, {});
    }

    /**
     * Save agents.json configuration
     */
    async saveAgentsConfig(basePath: string, config: AgentsJson): Promise<void> {
        const filePath = path.join(basePath, "agents.json");
        await this.saveConfig(filePath, config, AgentsJsonSchema);
    }

    /**
     * Get resolved LLM configuration for a specific agent or default
     */
    async getResolvedLLMConfig(
        contextPath: string,
        agentNameOrConfigName?: string,
        isGlobal = false
    ): Promise<LLMConfig | undefined> {
        const basePath = isGlobal ? this.getGlobalPath() : this.getProjectPath(contextPath);
        const llmConfig = await this.loadLLMConfig(basePath);
        return this.resolveConfigReference(llmConfig, agentNameOrConfigName);
    }

    /**
     * Resolve LLM configuration reference
     */
    resolveConfigReference(
        llmConfig: UnifiedLLMConfig,
        agentNameOrConfigName?: string
    ): LLMConfig | undefined {
        // If no name provided, use default
        const targetName = agentNameOrConfigName || llmConfig.defaults.default;

        if (!targetName) {
            return undefined;
        }

        // Check if it's a direct configuration reference
        if (llmConfig.configurations[targetName]) {
            const config = llmConfig.configurations[targetName];
            // Apply credentials if available
            if (config && llmConfig.credentials?.[config.provider]) {
                const creds = llmConfig.credentials[config.provider];
                return {
                    ...config,
                    apiKey: config.apiKey || creds?.apiKey,
                    baseURL: config.baseURL || creds?.baseUrl,
                };
            }
            return config;
        }

        // Check if it's an agent with a default configuration
        const agentDefault = llmConfig.defaults[targetName];
        if (agentDefault && llmConfig.configurations[agentDefault]) {
            const config = llmConfig.configurations[agentDefault];
            // Apply credentials if available
            if (config && llmConfig.credentials?.[config.provider]) {
                const creds = llmConfig.credentials[config.provider];
                return {
                    ...config,
                    apiKey: config.apiKey || creds?.apiKey,
                    baseURL: config.baseURL || creds?.baseUrl,
                };
            }
            return config;
        }

        return undefined;
    }

    /**
     * Generic configuration loader with caching and validation
     */
    private async loadConfig<T>(
        filePath: string,
        schema: z.ZodSchema<T>,
        defaultValue?: T
    ): Promise<T> {
        // Check cache first
        const cached = this.getFromCache<T>(filePath);
        if (cached) {
            return cached;
        }

        try {
            // Check if file exists
            if (!(await fileExists(filePath))) {
                if (defaultValue !== undefined) {
                    logger.debug(`Config file not found, using default: ${filePath}`);
                    return defaultValue;
                }
                throw new Error(`Configuration file not found: ${filePath}`);
            }

            // Load and parse file
            const data = await readJsonFile(filePath);

            // Validate with schema
            const validated = schema.parse(data);

            // Cache the result
            this.addToCache(filePath, validated);

            return validated as T;
        } catch (error) {
            if (error instanceof z.ZodError) {
                logger.error(`Configuration validation failed for ${filePath}:`, {
                    errors: error.errors,
                });
                throw new Error(
                    `Invalid configuration in ${filePath}: ${error.errors
                        .map((e) => `${e.path.join(".")}: ${e.message}`)
                        .join(", ")}`
                );
            }

            if (
                defaultValue !== undefined &&
                error instanceof Error &&
                error.message.includes("not found")
            ) {
                return defaultValue;
            }

            throw error;
        }
    }

    /**
     * Generic configuration saver with validation
     */
    private async saveConfig<T>(filePath: string, data: T, schema: z.ZodSchema<T>): Promise<void> {
        try {
            // Validate before saving
            const validated = schema.parse(data);

            // Save to file
            await writeJsonFile(filePath, validated);

            // Update cache
            this.addToCache(filePath, validated);

            logger.debug(`Configuration saved: ${filePath}`);
        } catch (error) {
            if (error instanceof z.ZodError) {
                logger.error(`Configuration validation failed for ${filePath}:`, {
                    errors: error.errors,
                });
                throw new Error(
                    `Invalid configuration data: ${error.errors
                        .map((e) => `${e.path.join(".")}: ${e.message}`)
                        .join(", ")}`
                );
            }
            throw error;
        }
    }

    /**
     * Get cached configuration
     */
    private getFromCache<T>(filePath: string): T | null {
        const entry = this.cache.get(filePath);
        if (!entry) {
            return null;
        }

        // Check if cache is still valid
        const now = Date.now();
        if (now - entry.timestamp > this.cacheTTL) {
            this.cache.delete(filePath);
            return null;
        }

        return entry.data as T;
    }

    /**
     * Add configuration to cache
     */
    private addToCache<T>(filePath: string, data: T): void {
        this.cache.set(filePath, {
            data,
            timestamp: Date.now(),
            filePath,
        });
    }

    /**
     * Clear cache for a specific file or all files
     */
    clearCache(filePath?: string): void {
        if (filePath) {
            this.cache.delete(filePath);
        } else {
            this.cache.clear();
        }
    }

    /**
     * Check if a configuration file exists
     */
    async configExists(
        contextPath: string,
        configType: "config" | "llms" | "agents",
        isGlobal = false
    ): Promise<boolean> {
        const basePath = isGlobal ? this.getGlobalPath() : this.getProjectPath(contextPath);
        const filePath = path.join(basePath, `${configType}.json`);
        return fileExists(filePath);
    }
}

// Export singleton instance
export const configurationService = new ConfigurationService();
