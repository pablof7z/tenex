import type { LLMConfig } from "@/utils/agents/types";
import { logger } from "@tenex/shared/node";
import { configurationService } from "@tenex/shared/services";
import type { UnifiedLLMConfig } from "@tenex/types/config";

export class LLMConfigManager {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Disables caching for a specific LLM configuration and persists the change to llms.json
   */
  async disableCachingForConfig(config: LLMConfig): Promise<void> {
    try {
      // Load the current configuration
      const configuration = await configurationService.loadConfiguration(this.projectPath);
      const llmsConfig = configuration.llms;

      // Find which key corresponds to this config
      const configKey = this.findConfigKey(llmsConfig, config);

      if (configKey && llmsConfig.configurations[configKey]) {
        // Update the config to disable caching
        llmsConfig.configurations[configKey].enableCaching = false;

        // Save back to file
        await configurationService.saveConfiguration(this.projectPath, configuration);
        logger.info(`Updated llms.json to disable caching for '${configKey}' configuration`);
      } else {
        logger.warn(`Could not find matching configuration in llms.json for model ${config.model}`);
      }
    } catch (error) {
      logger.error(`Failed to update llms.json: ${error}`);
      throw error;
    }
  }

  /**
   * Finds the key in llms.json that corresponds to the given LLM config
   */
  private findConfigKey(llmsConfig: UnifiedLLMConfig, targetConfig: LLMConfig): string | null {
    // Search through all configurations
    for (const [key, value] of Object.entries(llmsConfig.configurations)) {
      if (this.isMatchingConfig(value, targetConfig)) {
        return key;
      }
    }

    return null;
  }

  /**
   * Checks if two LLM configs match based on provider, model, and API key
   */
  private isMatchingConfig(config1: LLMConfig, config2: LLMConfig): boolean {
    return (
      config1.provider === config2.provider &&
      config1.model === config2.model &&
      config1.apiKey === config2.apiKey
    );
  }
}
