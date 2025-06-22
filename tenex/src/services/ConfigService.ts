import os from "node:os";
import path from "node:path";
import { fileExists, readJsonFile, writeJsonFile, ensureDirectory } from "@/lib/fs";
import { logger } from "@/utils/logger";
import type {
  TenexConfig,
  TenexAgents,
  TenexLLMs,
  LoadedConfig,
  ConfigFile,
} from "@/types/config";
import {
  TenexConfigSchema,
  TenexAgentsSchema,
  TenexLLMsSchema,
} from "@/types/config";

/**
 * Centralized configuration service for TENEX
 * Handles loading and saving of all configuration files
 * Pure file operations with validation - no business logic
 */
export class ConfigService {
  private static instance: ConfigService;
  private cache = new Map<string, { data: unknown; timestamp: number }>();
  private readonly cacheTTL = 5000; // 5 seconds

  private constructor() {}

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  // =====================================================================================
  // PATH UTILITIES
  // =====================================================================================

  private getGlobalPath(): string {
    return path.join(os.homedir(), ".tenex");
  }

  private getProjectPath(projectPath: string): string {
    return path.join(projectPath, ".tenex");
  }

  private getConfigFilePath(basePath: string, configFile: ConfigFile): string {
    return path.join(basePath, configFile);
  }

  // =====================================================================================
  // COMPLETE CONFIGURATION LOADING
  // =====================================================================================

  async loadConfig(projectPath?: string): Promise<LoadedConfig> {
    const globalPath = this.getGlobalPath();
    const projPath = projectPath ? this.getProjectPath(projectPath) : undefined;

    // Load global config
    const globalConfig = await this.loadTenexConfig(globalPath);
    
    // Load project config if provided
    let projectConfig: TenexConfig = {};
    if (projPath) {
      projectConfig = await this.loadTenexConfig(projPath);
    }

    // Merge configs (project overrides global)
    const config: TenexConfig = {
      ...globalConfig,
      ...projectConfig,
      // Merge arrays properly
      whitelistedPubkeys: [
        ...(globalConfig.whitelistedPubkeys || []),
        ...(projectConfig.whitelistedPubkeys || []),
      ],
    };

    // Load agents (merge global and project)
    const globalAgents = await this.loadTenexAgents(globalPath);
    const projectAgents = projPath ? await this.loadTenexAgents(projPath) : {};
    const agents: TenexAgents = { ...globalAgents, ...projectAgents };

    // Load LLMs (merge global and project)
    const globalLLMs = await this.loadTenexLLMs(globalPath);
    const projectLLMs = projPath ? await this.loadTenexLLMs(projPath) : { configurations: {}, defaults: {}, credentials: {} };
    const llms: TenexLLMs = {
      configurations: { ...globalLLMs.configurations, ...projectLLMs.configurations },
      defaults: { ...globalLLMs.defaults, ...projectLLMs.defaults },
      credentials: { ...globalLLMs.credentials, ...projectLLMs.credentials },
    };

    return { config, agents, llms };
  }

  // =====================================================================================
  // INDIVIDUAL FILE LOADING
  // =====================================================================================

  async loadTenexConfig(basePath: string): Promise<TenexConfig> {
    return this.loadConfigFile(
      this.getConfigFilePath(basePath, 'config.json'),
      TenexConfigSchema,
      {}
    );
  }

  async loadTenexAgents(basePath: string): Promise<TenexAgents> {
    return this.loadConfigFile(
      this.getConfigFilePath(basePath, 'agents.json'),
      TenexAgentsSchema,
      {}
    );
  }

  async loadTenexLLMs(basePath: string): Promise<TenexLLMs> {
    return this.loadConfigFile(
      this.getConfigFilePath(basePath, 'llms.json'),
      TenexLLMsSchema,
      { configurations: {}, defaults: {}, credentials: {} }
    );
  }

  // =====================================================================================
  // INDIVIDUAL FILE SAVING
  // =====================================================================================

  async saveTenexConfig(basePath: string, config: TenexConfig): Promise<void> {
    await this.saveConfigFile(
      this.getConfigFilePath(basePath, 'config.json'),
      config,
      TenexConfigSchema
    );
  }

  async saveTenexAgents(basePath: string, agents: TenexAgents): Promise<void> {
    await this.saveConfigFile(
      this.getConfigFilePath(basePath, 'agents.json'),
      agents,
      TenexAgentsSchema
    );
  }

  async saveTenexLLMs(basePath: string, llms: TenexLLMs): Promise<void> {
    await this.saveConfigFile(
      this.getConfigFilePath(basePath, 'llms.json'),
      llms,
      TenexLLMsSchema
    );
  }

  // =====================================================================================
  // CONVENIENCE METHODS
  // =====================================================================================

  async saveGlobalConfig(config: TenexConfig): Promise<void> {
    const globalPath = this.getGlobalPath();
    await ensureDirectory(globalPath);
    await this.saveTenexConfig(globalPath, config);
  }

  async saveProjectConfig(projectPath: string, config: TenexConfig): Promise<void> {
    const projPath = this.getProjectPath(projectPath);
    await ensureDirectory(projPath);
    await this.saveTenexConfig(projPath, config);
  }

  async saveGlobalAgents(agents: TenexAgents): Promise<void> {
    const globalPath = this.getGlobalPath();
    await ensureDirectory(globalPath);
    await this.saveTenexAgents(globalPath, agents);
  }

  async saveProjectAgents(projectPath: string, agents: TenexAgents): Promise<void> {
    const projPath = this.getProjectPath(projectPath);
    await ensureDirectory(projPath);
    await this.saveTenexAgents(projPath, agents);
  }

  async saveGlobalLLMs(llms: TenexLLMs): Promise<void> {
    const globalPath = this.getGlobalPath();
    await ensureDirectory(globalPath);
    await this.saveTenexLLMs(globalPath, llms);
  }

  async saveProjectLLMs(projectPath: string, llms: TenexLLMs): Promise<void> {
    const projPath = this.getProjectPath(projectPath);
    await ensureDirectory(projPath);
    await this.saveTenexLLMs(projPath, llms);
  }

  // =====================================================================================
  // FILE EXISTENCE CHECKS
  // =====================================================================================

  async configExists(basePath: string, configFile: ConfigFile): Promise<boolean> {
    return fileExists(this.getConfigFilePath(basePath, configFile));
  }

  async globalConfigExists(configFile: ConfigFile): Promise<boolean> {
    return this.configExists(this.getGlobalPath(), configFile);
  }

  async projectConfigExists(projectPath: string, configFile: ConfigFile): Promise<boolean> {
    return this.configExists(this.getProjectPath(projectPath), configFile);
  }

  // =====================================================================================
  // PRIVATE IMPLEMENTATION
  // =====================================================================================

  private async loadConfigFile<T>(
    filePath: string,
    schema: any,
    defaultValue: T
  ): Promise<T> {
    // Check cache first
    const cached = this.getFromCache<T>(filePath);
    if (cached) {
      return cached;
    }

    try {
      if (!(await fileExists(filePath))) {
        logger.debug(`Config file not found, using default: ${filePath}`);
        return defaultValue;
      }

      const data = await readJsonFile(filePath);
      const validated = schema.parse(data);
      
      this.addToCache(filePath, validated);
      return validated as T;
    } catch (error) {
      logger.error(`Failed to load config file: ${filePath}`, { error });
      return defaultValue;
    }
  }

  private async saveConfigFile<T>(
    filePath: string,
    data: T,
    schema: any
  ): Promise<void> {
    try {
      // Ensure directory exists
      await ensureDirectory(path.dirname(filePath));
      
      // Validate before saving
      const validated = schema.parse(data);
      
      // Save to file
      await writeJsonFile(filePath, validated);
      
      // Update cache
      this.addToCache(filePath, validated);
      
      logger.debug(`Configuration saved: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to save config file: ${filePath}`, { error });
      throw error;
    }
  }

  private getFromCache<T>(filePath: string): T | null {
    const entry = this.cache.get(filePath);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.cacheTTL) {
      this.cache.delete(filePath);
      return null;
    }

    return entry.data as T;
  }

  private addToCache<T>(filePath: string, data: T): void {
    this.cache.set(filePath, {
      data,
      timestamp: Date.now(),
    });
  }

  clearCache(filePath?: string): void {
    if (filePath) {
      this.cache.delete(filePath);
    } else {
      this.cache.clear();
    }
  }
}

// Export singleton instance
export const configService = ConfigService.getInstance();