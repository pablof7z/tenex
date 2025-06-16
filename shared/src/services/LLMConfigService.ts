import type { LLMConfig, LLMConfigs } from "@tenex/types/llm";
import { z } from "zod";

/**
 * Schema for validating LLM configuration
 */
const LLMConfigSchema = z.object({
    provider: z.enum(["anthropic", "openai", "openrouter", "google", "groq", "deepseek", "ollama"]),
    model: z.string(),
    apiKey: z.string().optional(),
    baseURL: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().positive().optional(),
    topP: z.number().min(0).max(1).optional(),
    topK: z.number().positive().optional(),
    frequencyPenalty: z.number().optional(),
    presencePenalty: z.number().optional(),
    stopSequences: z.array(z.string()).optional(),
    enableCaching: z.boolean().optional(),
    contextWindowSize: z.number().positive().optional(),
    timeout: z.number().positive().optional(),
});

/**
 * Unified service for managing LLM configurations
 * Handles validation, defaults, and configuration merging
 */
export class LLMConfigService {
    private configs: Map<string, LLMConfig> = new Map();
    private defaultConfigName?: string;

    constructor(configs?: LLMConfigs) {
        if (configs) {
            this.loadConfigs(configs);
        }
    }

    /**
     * Load configurations from LLMConfigs object
     */
    loadConfigs(configs: LLMConfigs): void {
        this.configs.clear();
        this.defaultConfigName = undefined;

        // Handle default config first to determine default name
        if (configs.default) {
            if (typeof configs.default === "string") {
                this.defaultConfigName = configs.default;
            } else {
                // Default is a full config
                const validated = this.validateConfig(configs.default);
                this.configs.set("default", validated);
                this.defaultConfigName = "default";
            }
        }

        // Load other configs
        for (const [name, config] of Object.entries(configs)) {
            if (name === "default") continue;

            if (typeof config === "string") {
            } else if (config) {
                const validated = this.validateConfig(config);
                this.configs.set(name, validated);
            }
        }

        // Resolve references (but skip if the name already exists - it was loaded as a real config)
        for (const [name, config] of Object.entries(configs)) {
            if (typeof config === "string" && !this.configs.has(name)) {
                const referenced = this.configs.get(config);
                if (referenced) {
                    this.configs.set(name, referenced);
                } else {
                    throw new Error(
                        `Configuration "${name}" references non-existent config "${config}"`
                    );
                }
            }
        }
    }

    /**
     * Validate and normalize an LLM configuration
     */
    validateConfig(config: unknown): LLMConfig {
        try {
            // Parse with Zod
            const parsed = LLMConfigSchema.parse(config);

            // Apply provider-specific defaults
            return this.applyProviderDefaults(parsed as LLMConfig);
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(
                    `Invalid LLM configuration: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
                );
            }
            throw error;
        }
    }

    /**
     * Apply provider-specific defaults
     */
    private applyProviderDefaults(config: LLMConfig): LLMConfig {
        const defaults: Partial<LLMConfig> = {
            temperature: 0.7,
            maxTokens: 4096,
        };

        // Provider-specific defaults
        switch (config.provider) {
            case "anthropic":
                defaults.maxTokens = 4096;
                defaults.enableCaching = true;
                break;
            case "openai":
                defaults.maxTokens = 4096;
                break;
            case "openrouter":
                defaults.maxTokens = 4096;
                defaults.enableCaching = true;
                break;
            case "ollama":
                defaults.maxTokens = 4096;
                defaults.baseURL = "http://localhost:11434/v1";
                defaults.temperature = 0.7;
                break;
        }

        return { ...defaults, ...config };
    }

    /**
     * Get a configuration by name
     */
    getConfig(name?: string): LLMConfig | undefined {
        if (!name) {
            // Return default config
            if (this.defaultConfigName) {
                return this.configs.get(this.defaultConfigName);
            }
            return this.configs.get("default");
        }
        return this.configs.get(name);
    }

    /**
     * Get all configurations
     */
    getAllConfigs(): Map<string, LLMConfig> {
        return new Map(this.configs);
    }

    /**
     * Add or update a configuration
     */
    setConfig(name: string, config: LLMConfig): void {
        const validated = this.validateConfig(config);
        this.configs.set(name, validated);
    }

    /**
     * Remove a configuration
     */
    removeConfig(name: string): boolean {
        return this.configs.delete(name);
    }

    /**
     * Set the default configuration name
     */
    setDefaultConfig(name: string): void {
        if (!this.configs.has(name)) {
            throw new Error(`Cannot set default to non-existent config "${name}"`);
        }
        this.defaultConfigName = name;
    }

    /**
     * Get the default configuration name
     */
    getDefaultConfigName(): string | undefined {
        return this.defaultConfigName;
    }

    /**
     * Merge two configurations, with overrides taking precedence
     */
    mergeConfigs(base: LLMConfig, overrides: Partial<LLMConfig>): LLMConfig {
        return this.validateConfig({ ...base, ...overrides });
    }

    /**
     * Export configurations to LLMConfigs format
     */
    exportConfigs(): LLMConfigs {
        const result: LLMConfigs = {};

        if (this.defaultConfigName) {
            result.default = this.defaultConfigName;
        }

        for (const [name, config] of this.configs) {
            result[name] = config;
        }

        return result;
    }

    /**
     * Check if a configuration requires an API key
     */
    requiresApiKey(config: LLMConfig): boolean {
        // Ollama typically doesn't require API keys for local instances
        if (config.provider === "ollama") {
            return false;
        }

        // Local providers (like Ollama via OpenAI API) don't need API keys
        if (config.baseURL?.includes("localhost")) {
            return false;
        }

        // Most providers require API keys
        return !config.apiKey;
    }

    /**
     * Validate that a configuration has all required fields for use
     */
    validateForUse(config: LLMConfig): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!config.model) {
            errors.push("Model is required");
        }

        if (this.requiresApiKey(config)) {
            errors.push(`API key is required for ${config.provider}`);
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }
}
