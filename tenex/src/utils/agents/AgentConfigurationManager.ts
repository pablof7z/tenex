import path from "node:path";
import type { OrchestrationConfig } from "@/core/orchestration/types";
import { readJsonFile } from "@tenex/shared/fs";
import { logger } from "@tenex/shared/node";
import { configurationService } from "@tenex/shared/services";
import type { AgentConfigEntry, AgentsJson } from "@tenex/types/agents";
import type { UnifiedLLMConfig } from "@tenex/types/config";
import type { LLMConfig } from "@tenex/types/llm";

/**
 * Manages agent and LLM configurations for a project
 * Handles loading, resolving, and providing access to configurations
 */
export class AgentConfigurationManager {
    private projectPath: string;
    private llmConfigs: Map<string, LLMConfig>;
    private unifiedLLMConfig?: UnifiedLLMConfig;

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
        try {
            const configuration = await configurationService.loadConfiguration(this.projectPath);
            this.unifiedLLMConfig = configuration.llms;

            logger.debug(`Loading LLM configs from ${this.projectPath}`);
            logger.debug(`Raw configs: ${JSON.stringify(this.unifiedLLMConfig, null, 2)}`);

            // Load all configurations
            for (const [name, config] of Object.entries(this.unifiedLLMConfig.configurations)) {
                this.llmConfigs.set(name, config);
                logger.info(`Loaded LLM config: ${name}`);
            }

            if (this.unifiedLLMConfig.defaults.default) {
                logger.info(`Default LLM config name: ${this.unifiedLLMConfig.defaults.default}`);
                const defaultConfig = this.resolveLLMConfig(this.unifiedLLMConfig.defaults.default);
                if (defaultConfig) {
                    logger.info(
                        `Default LLM provider: ${defaultConfig.provider}, model: ${defaultConfig.model}`
                    );
                }
            }
        } catch (error) {
            logger.error("No llms.json found or failed to load:", error);
            logger.error(`Attempted to load from project: ${this.projectPath}`);
            // Log the actual error details
            if (error instanceof Error) {
                logger.error(`Error message: ${error.message}`);
                logger.error(`Error stack: ${error.stack}`);
            }
        }
    }

    /**
     * Get LLM configuration by name, or default if no name provided
     */
    getLLMConfig(name?: string): LLMConfig | undefined {
        logger.debug(`getLLMConfig called with name: ${name || "undefined"}`);
        logger.debug(`Current llmConfigs size: ${this.llmConfigs.size}`);

        // If a specific name is requested, resolve it
        if (name) {
            const resolved = this.resolveLLMConfig(name);
            logger.debug(`Resolved config for ${name}: ${resolved ? "found" : "not found"}`);
            return resolved;
        }

        // Otherwise use default
        if (this.unifiedLLMConfig?.defaults.default) {
            const resolved = this.resolveLLMConfig(this.unifiedLLMConfig.defaults.default);
            logger.debug(
                `Resolved default config ${this.unifiedLLMConfig.defaults.default}: ${resolved ? "found" : "not found"}`
            );
            return resolved;
        }

        // Return first available config
        const firstConfig = this.llmConfigs.values().next().value;
        logger.debug(`Returning first available config: ${firstConfig ? "found" : "not found"}`);
        return firstConfig;
    }

    /**
     * Get LLM configuration for a specific agent, with fallback to default
     */
    getLLMConfigForAgent(agentName: string): LLMConfig | undefined {
        if (!this.unifiedLLMConfig) {
            return this.getLLMConfig();
        }

        // Check if there's an agent-specific default
        const agentDefault = this.unifiedLLMConfig.defaults[agentName];
        if (agentDefault) {
            const agentConfig = this.resolveLLMConfig(agentDefault);
            if (agentConfig) {
                return agentConfig;
            }
        }

        // Fall back to default
        return this.getLLMConfig();
    }

    /**
     * Resolve LLM configuration
     */
    private resolveLLMConfig(name: string): LLMConfig | undefined {
        if (!this.unifiedLLMConfig) {
            return undefined;
        }

        // Direct lookup in configurations
        const config = this.llmConfigs.get(name);
        if (config) {
            // Apply credentials if available
            if (this.unifiedLLMConfig.credentials?.[config.provider]) {
                const creds = this.unifiedLLMConfig.credentials[config.provider];
                return {
                    ...config,
                    apiKey: config.apiKey || creds.apiKey,
                    baseURL: config.baseURL || creds.baseUrl,
                };
            }
            return config;
        }

        // Use ConfigurationService's resolver for more complex cases
        return configurationService.resolveConfigReference(this.unifiedLLMConfig, name);
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
        return this.unifiedLLMConfig?.defaults.default;
    }

    /**
     * Load agents configuration from agents.json
     */
    async loadAgentsConfig(): Promise<AgentsJson> {
        try {
            const configuration = await configurationService.loadConfiguration(this.projectPath);
            return configuration.agents || {};
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.warn(`No agents.json found or failed to load: ${errorMessage}`);
            return {};
        }
    }

    /**
     * Get agent configuration entry by name
     */
    async getAgentConfigEntry(agentName: string): Promise<AgentConfigEntry | undefined> {
        const agentsConfig = await this.loadAgentsConfig();
        return agentsConfig[agentName];
    }

    /**
     * Load agent configuration file
     */
    async loadAgentConfigFile(agentName: string): Promise<
        | {
              name?: string;
              description?: string;
              role?: string;
              instructions?: string;
              version?: string;
          }
        | undefined
    > {
        const agentConfig = await this.getAgentConfigEntry(agentName);
        if (!agentConfig) return undefined;

        // Handle agent config with file reference
        if (agentConfig && agentConfig.file) {
            try {
                const filePath = path.join(
                    this.projectPath,
                    ".tenex",
                    "agents",
                    `${agentConfig.file}.json`
                );
                return readJsonFile(filePath);
            } catch (error) {
                logger.error(
                    `Failed to load agent config file for ${agentName}: ${agentConfig.file}`,
                    error
                );
                return undefined;
            }
        }

        return undefined;
    }

    /**
     * Get orchestration configuration
     */
    async getOrchestrationConfig(): Promise<Partial<OrchestrationConfig> | null> {
        if (!this.unifiedLLMConfig) {
            await this.initialize();
        }

        if (!this.unifiedLLMConfig) {
            return null;
        }

        const orchestratorConfigName =
            this.unifiedLLMConfig.defaults.orchestrator || this.unifiedLLMConfig.defaults.default;

        if (!orchestratorConfigName) {
            return null;
        }

        // Return the config name, not the config object
        return {
            orchestrator: {
                llmConfig: orchestratorConfigName,
                teamFormationLLMConfig: this.unifiedLLMConfig.defaults.orchestrator,
                maxTeamSize: 5,
                strategies: {},
            },
        };
    }

    /**
     * Update an agent's LLM configuration
     */
    async updateAgentLLMConfig(agentName: string, newConfigName: string): Promise<boolean> {
        try {
            const configuration = await configurationService.loadConfiguration(this.projectPath);

            if (!configuration.llms.configurations[newConfigName]) {
                logger.error(`LLM configuration '${newConfigName}' does not exist`);
                return false;
            }

            // Update the agent's default LLM configuration
            configuration.llms.defaults[agentName] = newConfigName;

            // Save the updated configuration
            await configurationService.saveConfiguration(this.projectPath, configuration);

            // Reload configurations
            await this.loadLLMConfigs();

            logger.info(`Updated agent '${agentName}' to use LLM configuration '${newConfigName}'`);
            return true;
        } catch (error) {
            logger.error(`Failed to update agent LLM config: ${error}`);
            return false;
        }
    }

    /**
     * Load agent definition from .tenex/agents/ directory
     */
    async loadAgentDefinition(filename: string): Promise<
        | {
              name?: string;
              description?: string;
              role?: string;
              instructions?: string;
              version?: string;
          }
        | undefined
    > {
        try {
            // Add .json extension if not present
            const fileName = filename.endsWith(".json") ? filename : `${filename}.json`;
            const filePath = path.join(this.projectPath, ".tenex", "agents", fileName);
            return readJsonFile(filePath);
        } catch (error) {
            logger.debug(`Failed to load agent definition ${filename}:`, error);
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
        try {
            const filePath = path.join(this.projectPath, ".tenex", "agents", `${agentName}.json`);
            return readJsonFile(filePath);
        } catch (error) {
            logger.debug(`Failed to load agent-specific config for ${agentName}:`, error);
            return undefined;
        }
    }

    /**
     * Get the project path
     */
    getProjectPath(): string {
        return this.projectPath;
    }
}
