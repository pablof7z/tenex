import path from "node:path";
import { logger } from "@tenex/shared";
import { readFile } from "@tenex/shared/fs";
import { configurationService } from "@tenex/shared/services";
import type { LLMSettings } from "@tenex/types/config";
import type { LLMConfig, LLMConfiguration, ProviderCredentials } from "./types";

export class LLMConfigManager {
  private configuration?: LLMConfiguration;
  private globalConfiguration?: LLMConfiguration;
  private mergedConfiguration?: LLMConfiguration;
  private configPath: string;
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.configPath = path.join(projectPath, ".tenex", "llms.json");
  }

  async loadConfigurations(): Promise<void> {
    try {
      // Load project configuration
      const projectConfig = await configurationService.loadLLMConfig(
        path.join(this.projectPath, ".tenex")
      );
      this.configuration = projectConfig;
      logger.info(`Loaded project LLM configurations from ${this.configPath}`);

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


  private mergeConfigurations(): LLMConfiguration {
    if (!this.globalConfiguration) {
      return this.configuration || { presets: {}, selection: {}, auth: {} };
    }

    if (!this.configuration) {
      return this.globalConfiguration;
    }

    // Merge configurations: project overrides global
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

    return preset;
  }

  getCredentials(provider: string): ProviderCredentials {
    if (!this.mergedConfiguration) {
      throw new Error("LLM configurations not loaded. Call loadConfigurations() first.");
    }

    const auth = this.mergedConfiguration.auth[provider];
    if (!auth) {
      throw new Error(`Auth for provider "${provider}" not found`);
    }

    return auth;
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
}
