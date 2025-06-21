import os from "node:os";
import path from "node:path";
import { fileExists, readJsonFile, writeJsonFile } from "@tenex/shared/fs";
import { logger } from "@tenex/shared/logger";
import type {
    AgentsJson,
    TrackedAgentsJson,
    ConfigurationLoadOptions,
} from "@tenex/types/agents";
import type {
    GlobalConfig,
    ProjectConfig,
    TenexConfiguration,
    LLMSettings,
    LLMPreset,
    ProviderAuth,
} from "@tenex/types/config";
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

// Unified LLM settings schema
const LLMSettingsSchema = z.object({
    presets: z.record(LLMConfigSchema),
    selection: z.record(z.string()),
    auth: z.record(LLMCredentialsSchema),
});

// Agent config schema
const AgentConfigSchema = z.object({
    name: z.string(),
    role: z.string(),
    expertise: z.string(),
    instructions: z.string(),
    llmConfig: z.string().optional(),
    tools: z.array(z.string()).optional(),
});

const AgentsJsonSchema = z.object({
    agents: z.record(AgentConfigSchema),
});

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
    async loadConfiguration(
        contextPath: string,
        isGlobal = false,
        options?: ConfigurationLoadOptions
    ): Promise<TenexConfiguration> {
        const basePath = isGlobal ? this.getGlobalPath() : this.getProjectPath(contextPath);

        // Load config.json
        const config = isGlobal
            ? await this.loadGlobalConfig(basePath)
            : await this.loadProjectConfig(basePath);

        // Load llms.json
        const llms = await this.loadLLMConfig(basePath);

        // Load agents.json
        let agents: AgentsJson | undefined;
        const agentsPath = path.join(basePath, "agents.json");
        if (await fileExists(agentsPath)) {
            agents = await this.loadAgentsConfig(basePath);
        }

        // For project configurations, merge with global agents (unless disabled)
        if (!isGlobal && !options?.skipGlobal) {
            const globalAgentsPath = path.join(this.getGlobalPath(), "agents.json");
            if (await fileExists(globalAgentsPath)) {
                const globalAgents = await this.loadAgentsConfig(this.getGlobalPath());
                // Merge with source tracking
                agents = await this.mergeAgentsWithTracking(
                    globalAgents,
                    agents || { agents: {} },
                    this.getGlobalPath(),
                    basePath
                );
            } else if (agents) {
                // Only project agents, add source tracking
                agents = this.addSourceTracking(agents, basePath, "project");
            }
        } else if (agents) {
            // Add source tracking for non-merged agents
            agents = this.addSourceTracking(agents, basePath, isGlobal ? "global" : "project");
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
        if (configuration.llms) {
            await this.saveLLMConfig(basePath, configuration.llms);
        }

        // Save agents.json (if provided)
        if (configuration.agents) {
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
    async loadLLMConfig(basePath: string): Promise<LLMSettings> {
        const filePath = path.join(basePath, "llms.json");
        return this.loadConfig(filePath, LLMSettingsSchema, {
            presets: {},
            selection: {},
            auth: {},
        });
    }

    /**
     * Save llms.json configuration
     */
    async saveLLMConfig(basePath: string, config: LLMSettings): Promise<void> {
        const filePath = path.join(basePath, "llms.json");
        await this.saveConfig(filePath, config, LLMSettingsSchema);
    }

    /**
     * Load agents.json configuration
     */
    async loadAgentsConfig(basePath: string): Promise<AgentsJson> {
        const filePath = path.join(basePath, "agents.json");
        return this.loadConfig(filePath, AgentsJsonSchema, { agents: {} });
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
    ): Promise<LLMPreset | undefined> {
        const basePath = isGlobal ? this.getGlobalPath() : this.getProjectPath(contextPath);
        const llmConfig = await this.loadLLMConfig(basePath);
        return this.resolveConfigReference(llmConfig, agentNameOrConfigName);
    }

    /**
     * Resolve LLM configuration reference
     */
    resolveConfigReference(
        llmSettings: LLMSettings,
        agentNameOrConfigName?: string
    ): LLMPreset | undefined {
        // If no name provided, use default
        const targetName = agentNameOrConfigName || llmSettings.selection.default;

        if (!targetName) {
            return undefined;
        }

        // Check if it's a direct preset reference
        if (llmSettings.presets[targetName]) {
            return llmSettings.presets[targetName];
        }

        // Check if it's an agent with a selected preset
        const agentSelection = llmSettings.selection[targetName];
        if (agentSelection && llmSettings.presets[agentSelection]) {
            return llmSettings.presets[agentSelection];
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

    /**
     * Add source tracking to agent configurations
     */
    private addSourceTracking(
        agents: AgentsJson,
        basePath: string,
        source: "global" | "project"
    ): TrackedAgentsJson {
        const tracked: TrackedAgentsJson = { agents: {} };

        for (const [key, agent] of Object.entries(agents.agents)) {
            tracked.agents[key] = {
                ...agent,
                source: source,
            };
        }

        return tracked;
    }

    /**
     * Merge global and project agents with source tracking and warnings
     */
    private async mergeAgentsWithTracking(
        globalAgents: AgentsJson,
        projectAgents: AgentsJson,
        globalPath: string,
        projectPath: string
    ): Promise<TrackedAgentsJson> {
        const merged: TrackedAgentsJson = { agents: {} };

        // Add global agents with tracking
        for (const [key, agent] of Object.entries(globalAgents.agents)) {
            merged.agents[key] = {
                ...agent,
                source: "global",
            };
        }

        // Add/override with project agents
        for (const [key, agent] of Object.entries(projectAgents.agents)) {
            if (merged.agents[key]) {
                // Warn about override
                logger.warn(
                    `Agent '${key}' from global configuration is being overridden by project configuration`
                );
            }

            merged.agents[key] = {
                ...agent,
                source: "project",
            };
        }

        return merged;
    }
}

// Export singleton instance
export const configurationService = new ConfigurationService();
