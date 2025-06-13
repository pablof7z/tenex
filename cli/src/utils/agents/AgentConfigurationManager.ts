import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type {
	AgentConfigEntry,
	LegacyAgentsJson as AgentsConfig,
} from "@tenex/types/agents";
import type { LLMConfig, LLMConfigs } from "@tenex/types/llm";
import { logger } from "../logger";

/**
 * Manages agent and LLM configurations for a project
 * Handles loading, resolving, and providing access to configurations
 */
export class AgentConfigurationManager {
	private projectPath: string;
	private llmConfigs: Map<string, LLMConfig>;
	private defaultLLM?: string;

	constructor(projectPath: string) {
		this.projectPath = projectPath;
		this.llmConfigs = new Map();
	}

	/**
	 * Initialize configuration manager by loading LLM configs
	 */
	async initialize(): Promise<void> {
		await this.loadLLMConfigs();
	}

	/**
	 * Load LLM configurations from llms.json
	 */
	private async loadLLMConfigs(): Promise<void> {
		const llmsPath = path.join(this.projectPath, ".tenex", "llms.json");

		try {
			const content = await fs.readFile(llmsPath, "utf-8");
			const configs: LLMConfigs = JSON.parse(content);

			// Handle two possible structures:
			// 1. { "default": "configName", "configName": {...} }
			// 2. { "default": {...} }
			if (configs.default) {
				if (typeof configs.default === "string") {
					// Case 1: default is a reference to another config
					this.defaultLLM = configs.default;
				} else if (typeof configs.default === "object") {
					// Case 2: default is the actual config
					this.defaultLLM = "default";
					this.llmConfigs.set("default", configs.default as LLMConfig);
					logger.info("Loaded LLM config: default");
				}
			}

			// Load all configs (both objects and string references)
			for (const [name, config] of Object.entries(configs)) {
				if (typeof config === "object") {
					// It's an actual config object
					this.llmConfigs.set(name, config as LLMConfig);
					logger.info(`Loaded LLM config: ${name}`);
				} else if (typeof config === "string" && name !== "default") {
					// It's a reference - we'll resolve it later in getLLMConfig
					logger.info(`Found LLM config reference: ${name} -> ${config}`);
				}
			}

			if (this.defaultLLM) {
				logger.info(`Default LLM config name: ${this.defaultLLM}`);
				const defaultConfig = this.resolveLLMConfig(this.defaultLLM);
				if (defaultConfig) {
					logger.info(
						`Default LLM provider: ${defaultConfig.provider}, model: ${defaultConfig.model}`,
					);
				}
			}
		} catch (error) {
			logger.warn("No llms.json found or failed to load:", error);
		}
	}

	/**
	 * Get LLM configuration by name, or default if no name provided
	 */
	getLLMConfig(name?: string): LLMConfig | undefined {
		// If a specific name is requested, resolve it (handling references)
		if (name) {
			return this.resolveLLMConfig(name);
		}

		// Otherwise use default
		if (this.defaultLLM) {
			return this.resolveLLMConfig(this.defaultLLM);
		}

		// Return first available config
		return this.llmConfigs.values().next().value;
	}

	/**
	 * Get LLM configuration for a specific agent, with fallback to default
	 */
	getLLMConfigForAgent(agentName: string): LLMConfig | undefined {
		// First try agent-specific config
		const agentConfig = this.resolveLLMConfig(agentName);
		if (agentConfig) {
			return agentConfig;
		}

		// Fall back to default
		return this.getLLMConfig();
	}

	/**
	 * Resolve LLM configuration, handling references and circular dependencies
	 */
	private resolveLLMConfig(
		name: string,
		visited: Set<string> = new Set(),
	): LLMConfig | undefined {
		// Check for circular references
		if (visited.has(name)) {
			logger.warn(`Circular reference detected in LLM config: ${name}`);
			return undefined;
		}
		visited.add(name);

		const config = this.llmConfigs.get(name);

		// If config not found, check in raw llms.json for string references
		if (!config) {
			const llmsPath = path.join(this.projectPath, ".tenex", "llms.json");
			try {
				const content = readFileSync(llmsPath, "utf-8");
				const configs = JSON.parse(content);
				const rawConfig = configs[name];

				if (typeof rawConfig === "string") {
					// It's a reference to another config
					logger.info(`Config '${name}' references '${rawConfig}'`);
					return this.resolveLLMConfig(rawConfig, visited);
				}
			} catch (error) {
				// Ignore errors, config not found
			}
			return undefined;
		}

		return config;
	}

	/**
	 * Get all LLM configurations
	 */
	getAllLLMConfigs(): Map<string, LLMConfig> {
		return new Map(this.llmConfigs);
	}

	/**
	 * Get the default LLM configuration name
	 */
	getDefaultLLMName(): string | undefined {
		return this.defaultLLM;
	}

	/**
	 * Load agents configuration from agents.json
	 */
	async loadAgentsConfig(): Promise<AgentsConfig> {
		const agentsPath = path.join(this.projectPath, ".tenex", "agents.json");
		try {
			const content = await fs.readFile(agentsPath, "utf-8");
			return JSON.parse(content) as AgentsConfig;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			logger.warn(`No agents.json found or failed to load: ${errorMessage}`);
			return {};
		}
	}

	/**
	 * Get agent configuration entry by name
	 */
	async getAgentConfigEntry(
		agentName: string,
	): Promise<AgentConfigEntry | string | undefined> {
		const agentsConfig = await this.loadAgentsConfig();
		return agentsConfig[agentName];
	}

	/**
	 * Load agent definition from cached NDKAgent event file
	 */
	async loadAgentDefinition(configFile: string): Promise<
		| {
				description?: string;
				role?: string;
				instructions?: string;
				name?: string;
				version?: string;
		  }
		| undefined
	> {
		const defPath = path.join(this.projectPath, ".tenex", "agents", configFile);
		try {
			const content = await fs.readFile(defPath, "utf-8");
			return JSON.parse(content);
		} catch (error) {
			logger.warn(`Failed to load agent definition from ${configFile}:`, error);
			return undefined;
		}
	}

	/**
	 * Load agent-specific configuration file
	 */
	async loadAgentSpecificConfig(agentName: string): Promise<
		| {
				description?: string;
				role?: string;
				instructions?: string;
		  }
		| undefined
	> {
		const agentConfigPath = path.join(
			this.projectPath,
			".tenex",
			"agents",
			`${agentName}.json`,
		);
		try {
			const content = await fs.readFile(agentConfigPath, "utf-8");
			return JSON.parse(content);
		} catch (error) {
			// Agent might not have a config file
			return undefined;
		}
	}

	/**
	 * Get project path
	 */
	getProjectPath(): string {
		return this.projectPath;
	}
}
