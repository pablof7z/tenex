import path from "node:path";
import { readJsonFile, writeJsonFile, ensureDirectory } from "../fs/filesystem.js";
import { logError, logInfo } from "../logger.js";
import { getErrorMessage } from "@tenex/types/utils";
export class ConfigLoader {
    configPath;
    options;
    constructor(configPath, options = {}) {
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
    async load() {
        try {
            const config = await readJsonFile(this.configPath);
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
        }
        catch (error) {
            logError(`Failed to load config from ${this.configPath}: ${getErrorMessage(error)}`);
            throw error;
        }
    }
    /**
     * Save configuration to file
     */
    async save(config) {
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
        }
        catch (error) {
            logError(`Failed to save config to ${this.configPath}: ${getErrorMessage(error)}`);
            throw error;
        }
    }
    /**
     * Update specific fields in the configuration
     */
    async update(updates) {
        const current = await this.load();
        const updated = { ...current, ...updates };
        await this.save(updated);
        return updated;
    }
    /**
     * Merge configuration with existing one
     */
    async merge(config) {
        const current = (await this.load()) || {};
        const merged = this.deepMerge(current, config);
        await this.save(merged);
        return merged;
    }
    /**
     * Check if configuration file exists
     */
    async exists() {
        const config = await readJsonFile(this.configPath);
        return config !== null;
    }
    /**
     * Reset configuration to default
     */
    async reset() {
        if (!this.options.defaultConfig) {
            throw new Error("No default configuration provided");
        }
        await this.save(this.options.defaultConfig);
    }
    /**
     * Create a backup of the current configuration
     */
    async createBackup() {
        const config = await readJsonFile(this.configPath);
        if (config !== null) {
            const backupPath = `${this.configPath}.backup.${Date.now()}`;
            await writeJsonFile(backupPath, config);
        }
    }
    /**
     * Get the configuration file path
     */
    getPath() {
        return this.configPath;
    }
    /**
     * Deep merge two objects
     */
    deepMerge(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source[key] !== null &&
                typeof source[key] === "object" &&
                !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            }
            else {
                result[key] = source[key];
            }
        }
        return result;
    }
}
/**
 * Factory function for creating config loaders
 */
export function createConfigLoader(configPath, options = {}) {
    return new ConfigLoader(configPath, options);
}
/**
 * Load configuration with simple interface
 */
export async function loadConfig(configPath, defaultConfig) {
    const loader = createConfigLoader(configPath, { defaultConfig, autoCreate: true });
    return loader.load();
}
/**
 * Save configuration with simple interface
 */
export async function saveConfig(configPath, config) {
    const loader = createConfigLoader(configPath);
    return loader.save(config);
}
//# sourceMappingURL=loader.js.map