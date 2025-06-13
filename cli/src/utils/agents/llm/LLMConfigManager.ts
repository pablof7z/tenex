import fs from "node:fs/promises";
import path from "node:path";
import type { LLMConfigs } from "@tenex/types/llm";
import { logger } from "../../logger";
import type { LLMConfig } from "../types";

export class LLMConfigManager {
	private projectPath: string;

	constructor(projectPath: string) {
		this.projectPath = projectPath;
	}

	/**
	 * Disables caching for a specific LLM configuration and persists the change to llms.json
	 */
	async disableCachingForConfig(config: LLMConfig): Promise<void> {
		const llmsPath = path.join(this.projectPath, ".tenex", "llms.json");

		try {
			// Read the current llms.json
			const llmsData = await fs.readFile(llmsPath, "utf-8");
			const llmsConfig = JSON.parse(llmsData);

			// Find which key corresponds to this config
			const configKey = this.findConfigKey(llmsConfig, config);

			if (configKey) {
				// Update the config to disable caching
				llmsConfig[configKey].enableCaching = false;

				// Write back to file
				await fs.writeFile(llmsPath, JSON.stringify(llmsConfig, null, 2));
				logger.info(
					`Updated llms.json to disable caching for '${configKey}' configuration`,
				);
			} else {
				logger.warn(
					`Could not find matching configuration in llms.json for model ${config.model}`,
				);
			}
		} catch (error) {
			logger.error(`Failed to update llms.json: ${error}`);
			throw error;
		}
	}

	/**
	 * Finds the key in llms.json that corresponds to the given LLM config
	 */
	private findConfigKey(
		llmsConfig: LLMConfigs,
		targetConfig: LLMConfig,
	): string | null {
		// Check if it's the default config
		if (
			llmsConfig.default &&
			typeof llmsConfig[llmsConfig.default] === "object"
		) {
			const defaultConfig = llmsConfig[llmsConfig.default];
			if (this.isMatchingConfig(defaultConfig, targetConfig)) {
				return llmsConfig.default;
			}
		}

		// Search through all configs
		for (const [key, value] of Object.entries(llmsConfig)) {
			if (
				typeof value === "object" &&
				this.isMatchingConfig(value as LLMConfig, targetConfig)
			) {
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
