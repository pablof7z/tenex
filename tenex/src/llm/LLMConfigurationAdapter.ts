import { configurationService } from "@tenex/shared/services";
import type { LLMSettings, LLMPreset, ProviderAuth } from "@tenex/types/config";
import { logger } from "@tenex/shared";
import type { LLMConfig, ProviderCredentials } from "./types";
import path from "node:path";

/**
 * Adapter that provides LLMConfigManager interface using ConfigurationService
 * This replaces the duplicate LLMConfigManager class
 */
export class LLMConfigurationAdapter {
  private projectPath: string;
  private mergedConfiguration: LLMSettings | null = null;
  private globalConfiguration: LLMSettings | null = null;
  private configuration: LLMSettings | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async loadConfigurations(): Promise<void> {
    try {
      // Load project configuration using ConfigurationService
      const projectConfig = await configurationService.loadLLMConfig(
        path.join(this.projectPath, ".tenex")
      );
      this.configuration = projectConfig;
      logger.info(`Loaded project LLM configurations from ${this.projectPath}/.tenex/llms.json`);

      // Load global configuration
      try {
        const globalPath = path.join(process.env.HOME || "~", ".tenex");
        const globalConfig = await configurationService.loadLLMConfig(globalPath);
        this.globalConfiguration = globalConfig;
        logger.info(`Loaded global LLM configurations from ${globalPath}/llms.json`);
      } catch (error) {
        logger.debug("No global LLM configuration found, using project configuration only");
      }

      // Merge configurations (project takes precedence)
      this.mergedConfiguration = this.mergeConfigurations();
    } catch (error) {
      logger.error(`Failed to load LLM configurations`, { error });
      throw new Error(`Failed to load LLM configurations: ${error}`);
    }
  }

  private mergeConfigurations(): LLMSettings {
    if (!this.globalConfiguration) {
      return this.configuration || { presets: {}, selection: {}, auth: {} };
    }

    if (!this.configuration) {
      return this.globalConfiguration;
    }

    return {
      presets: {
        ...this.globalConfiguration.presets,
        ...this.configuration.presets,
      },
      selection: {
        ...this.globalConfiguration.selection,
        ...this.configuration.selection,
      },
      auth: {
        ...this.globalConfiguration.auth,
        ...this.configuration.auth,
      },
    };
  }

  getConfig(name: string): LLMConfig {
    if (!this.mergedConfiguration) {
      throw new Error("LLM configurations not loaded. Call loadConfigurations() first.");
    }

    const preset = this.mergedConfiguration.presets[name];
    if (!preset) {
      throw new Error(`LLM preset "${name}" not found`);
    }

    return preset as LLMConfig;
  }

  getCredentials(provider: string): ProviderCredentials {
    if (!this.mergedConfiguration) {
      throw new Error("LLM configurations not loaded. Call loadConfigurations() first.");
    }

    const auth = this.mergedConfiguration.auth[provider];
    if (!auth) {
      throw new Error(`Auth for provider "${provider}" not found`);
    }

    return auth as ProviderCredentials;
  }

  getDefaultConfig(purpose = "default"): string {
    if (!this.mergedConfiguration) {
      throw new Error("LLM configurations not loaded. Call loadConfigurations() first.");
    }

    const selection =
      this.mergedConfiguration.selection[purpose] || this.mergedConfiguration.selection.default;

    if (!selection) {
      throw new Error(`LLM selection for purpose "${purpose}" not found`);
    }

    return selection;
  }

  getAllConfigNames(): string[] {
    if (!this.mergedConfiguration) {
      return [];
    }
    return Object.keys(this.mergedConfiguration.presets);
  }

  hasConfig(name: string): boolean {
    if (!this.mergedConfiguration) {
      return false;
    }
    return name in this.mergedConfiguration.presets;
  }

  getAvailableProviders(): string[] {
    if (!this.mergedConfiguration) {
      return [];
    }
    return Object.keys(this.mergedConfiguration.auth);
  }
}