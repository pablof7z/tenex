import path from "node:path";
import { logger } from "@tenex/shared";
import { readFile } from "@tenex/shared/fs";
import type { LLMConfig, LLMConfiguration, ProviderCredentials } from "./types";

export class LLMConfigManager {
  private configuration?: LLMConfiguration;
  private configPath: string;

  constructor(projectPath: string) {
    this.configPath = path.join(projectPath, ".tenex", "llms.json");
  }

  async loadConfigurations(): Promise<void> {
    try {
      const content = await readFile(this.configPath, "utf-8");
      this.configuration = JSON.parse(content) as LLMConfiguration;
      logger.info(`Loaded LLM configurations from ${this.configPath}`);
    } catch (error) {
      logger.error(`Failed to load LLM configurations from ${this.configPath}`, { error });
      throw new Error(`Failed to load LLM configurations: ${error}`);
    }
  }

  getConfig(name: string): LLMConfig {
    if (!this.configuration) {
      throw new Error("LLM configurations not loaded. Call loadConfigurations() first.");
    }

    const config = this.configuration.configurations[name];
    if (!config) {
      throw new Error(`LLM configuration "${name}" not found`);
    }

    return config;
  }

  getCredentials(provider: string): ProviderCredentials {
    if (!this.configuration) {
      throw new Error("LLM configurations not loaded. Call loadConfigurations() first.");
    }

    const credentials = this.configuration.credentials[provider];
    if (!credentials) {
      throw new Error(`Credentials for provider "${provider}" not found`);
    }

    return credentials;
  }

  getDefaultConfig(purpose = "default"): string {
    if (!this.configuration) {
      throw new Error("LLM configurations not loaded. Call loadConfigurations() first.");
    }

    const config = (
      this.configuration.defaults[purpose] || this.configuration.defaults.default
    );

    if (!config) {
      throw new Error(`Default LLM configuration for purpose "${purpose}" not found`);
    }

    return config;
  }

  getAllConfigNames(): string[] {
    if (!this.configuration) {
      return [];
    }
    return Object.keys(this.configuration.configurations);
  }
}
