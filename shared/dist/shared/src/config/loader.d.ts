/**
 * Configuration loading utilities to eliminate duplicated patterns
 * across LLMConfigManager, AgentConfigManager, and other config handlers
 */
export interface ConfigLoaderOptions<T> {
    defaultConfig?: T;
    validate?: (config: T) => boolean;
    transform?: (config: any) => T;
    autoCreate?: boolean;
    autoBackup?: boolean;
}
export declare class ConfigLoader<T extends Record<string, any>> {
    private configPath;
    private options;
    constructor(configPath: string, options?: ConfigLoaderOptions<T>);
    /**
     * Load configuration from file
     */
    load(): Promise<T | null>;
    /**
     * Save configuration to file
     */
    save(config: T): Promise<void>;
    /**
     * Update specific fields in the configuration
     */
    update(updates: Partial<T>): Promise<T>;
    /**
     * Merge configuration with existing one
     */
    merge(config: Partial<T>): Promise<T>;
    /**
     * Check if configuration file exists
     */
    exists(): Promise<boolean>;
    /**
     * Reset configuration to default
     */
    reset(): Promise<void>;
    /**
     * Create a backup of the current configuration
     */
    createBackup(): Promise<void>;
    /**
     * Get the configuration file path
     */
    getPath(): string;
    /**
     * Deep merge two objects
     */
    private deepMerge;
}
/**
 * Factory function for creating config loaders
 */
export declare function createConfigLoader<T extends Record<string, any>>(configPath: string, options?: ConfigLoaderOptions<T>): ConfigLoader<T>;
/**
 * Load configuration with simple interface
 */
export declare function loadConfig<T extends Record<string, any>>(configPath: string, defaultConfig?: T): Promise<T | null>;
/**
 * Save configuration with simple interface
 */
export declare function saveConfig<T extends Record<string, any>>(configPath: string, config: T): Promise<void>;
//# sourceMappingURL=loader.d.ts.map