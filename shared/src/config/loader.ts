import path from "node:path";
import { getErrorMessage } from "@tenex/types/utils";
import { readJsonFile, writeJsonFile } from "../fs/filesystem.js";
import { logError, logInfo } from "../logger.js";

/**
 * Configuration loading utilities to eliminate duplicated patterns
 * across LLMConfigManager, AgentConfigManager, and other config handlers
 */

export interface ConfigLoaderOptions<T> {
    defaultConfig?: T;
    validate?: (config: T) => boolean;
    transform?: (config: unknown) => T;
    autoCreate?: boolean;
    autoBackup?: boolean;
}

export class ConfigLoader<T extends Record<string, unknown>> {
    private configPath: string;
    private options: ConfigLoaderOptions<T>;

    constructor(configPath: string, options: ConfigLoaderOptions<T> = {}) {
        this.configPath = path.resolve(configPath);
        this.options = {
            autoCreate: true,
            autoBackup: false,
            ...options,
        };
    }

    /**
     * Load configuration from file
     */
    async load(): Promise<T | null> {
        try {
            const config = await readJsonFile<T>(this.configPath);

            if (config === null) {
                if (this.options.autoCreate && this.options.defaultConfig) {
                    logInfo(`Config file not found, creating default: ${this.configPath}`);
                    await this.save(this.options.defaultConfig);
                    return this.options.defaultConfig;
                }
                return null;
            }

            // Transform if needed
            const transformedConfig = this.options.transform
                ? this.options.transform(config)
                : config;

            // Validate if validator provided
            if (this.options.validate && !this.options.validate(transformedConfig)) {
                throw new Error("Configuration validation failed");
            }

            return transformedConfig;
        } catch (error) {
            logError(`Failed to load config from ${this.configPath}: ${getErrorMessage(error)}`);
            throw error;
        }
    }

    /**
     * Save configuration to file
     */
    async save(config: T): Promise<void> {
        try {
            // Create backup if enabled
            if (this.options.autoBackup) {
                await this.createBackup();
            }

            // Validate before saving
            if (this.options.validate && !this.options.validate(config)) {
                throw new Error("Configuration validation failed before save");
            }

            await writeJsonFile(this.configPath, config);
        } catch (error) {
            logError(`Failed to save config to ${this.configPath}: ${getErrorMessage(error)}`);
            throw error;
        }
    }

    /**
     * Update specific fields in the configuration
     */
    async update(updates: Partial<T>): Promise<T> {
        const current = await this.load();
        const updated = { ...current, ...updates } as T;
        await this.save(updated);
        return updated;
    }

    /**
     * Merge configuration with existing one
     */
    async merge(config: Partial<T>): Promise<T> {
        const current = (await this.load()) || ({} as T);
        const merged = this.deepMerge(current, config) as T;
        await this.save(merged);
        return merged;
    }

    /**
     * Check if configuration file exists
     */
    async exists(): Promise<boolean> {
        const config = await readJsonFile(this.configPath);
        return config !== null;
    }

    /**
     * Reset configuration to default
     */
    async reset(): Promise<void> {
        if (!this.options.defaultConfig) {
            throw new Error("No default configuration provided");
        }
        await this.save(this.options.defaultConfig);
    }

    /**
     * Create a backup of the current configuration
     */
    async createBackup(): Promise<void> {
        const config = await readJsonFile(this.configPath);
        if (config !== null) {
            const backupPath = `${this.configPath}.backup.${Date.now()}`;
            await writeJsonFile(backupPath, config);
        }
    }

    /**
     * Get the configuration file path
     */
    getPath(): string {
        return this.configPath;
    }

    /**
     * Deep merge two objects
     */
    private deepMerge<U extends Record<string, unknown>>(target: U, source: Partial<U>): U {
        const result: Record<string, unknown> = { ...target };

        for (const key in source) {
            const sourceValue = source[key];
            if (sourceValue === undefined) continue;

            if (
                sourceValue !== null &&
                typeof sourceValue === "object" &&
                !Array.isArray(sourceValue)
            ) {
                const targetValue = target[key];
                if (targetValue && typeof targetValue === "object" && !Array.isArray(targetValue)) {
                    result[key] = this.deepMerge(
                        targetValue as Record<string, unknown>,
                        sourceValue as Record<string, unknown>
                    );
                } else {
                    result[key] = sourceValue;
                }
            } else {
                result[key] = sourceValue;
            }
        }

        return result as U;
    }
}

/**
 * Factory function for creating config loaders
 */
export function createConfigLoader<T extends Record<string, unknown>>(
    configPath: string,
    options: ConfigLoaderOptions<T> = {}
): ConfigLoader<T> {
    return new ConfigLoader(configPath, options);
}

/**
 * Load configuration with simple interface
 */
export async function loadConfig<T extends Record<string, unknown>>(
    configPath: string,
    defaultConfig?: T
): Promise<T | null> {
    const loader = createConfigLoader(configPath, { defaultConfig, autoCreate: true });
    return loader.load();
}

/**
 * Save configuration with simple interface
 */
export async function saveConfig<T extends Record<string, unknown>>(
    configPath: string,
    config: T
): Promise<void> {
    const loader = createConfigLoader<T>(configPath);
    return loader.save(config);
}
