import path from "node:path";
import { logger } from "@tenex/shared/node";
import type { AgentConfigEntry, LegacyAgentsJson as AgentsConfig } from "@tenex/types/agents";
import type { LLMConfig, LLMConfigs } from "@tenex/types/llm";
import { fs } from "../fs";

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
            const configs = await fs.readJSON<LLMConfigs>(llmsPath);
            if (!configs) throw new Error("No llms.json found");

            logger.debug(`Loading LLM configs from ${llmsPath}`);
            logger.debug(`Raw configs: ${JSON.stringify(configs, null, 2)}`);

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
                        `Default LLM provider: ${defaultConfig.provider}, model: ${defaultConfig.model}`
                    );
                }
            }
        } catch (error) {
            logger.error("No llms.json found or failed to load:", error);
            logger.error(`Attempted to load from: ${llmsPath}`);
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
        logger.debug(`Current defaultLLM: ${this.defaultLLM || "undefined"}`);

        // If a specific name is requested, resolve it (handling references)
        if (name) {
            const resolved = this.resolveLLMConfig(name);
            logger.debug(`Resolved config for ${name}: ${resolved ? "found" : "not found"}`);
            return resolved;
        }

        // Otherwise use default
        if (this.defaultLLM) {
            const resolved = this.resolveLLMConfig(this.defaultLLM);
            logger.debug(
                `Resolved default config ${this.defaultLLM}: ${resolved ? "found" : "not found"}`
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
        visited: Set<string> = new Set()
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
                const content = fs.readFileSync(llmsPath, "utf-8");
                const configs = JSON.parse(content);
                const rawConfig = configs[name];

                if (typeof rawConfig === "string") {
                    // It's a reference to another config
                    logger.info(`Config '${name}' references '${rawConfig}'`);
                    return this.resolveLLMConfig(rawConfig, visited);
                }
            } catch (_error) {
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
            const config = await fs.readJSON<AgentsConfig>(agentsPath);
            return config || {};
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.warn(`No agents.json found or failed to load: ${errorMessage}`);
            return {};
        }
    }

    /**
     * Get agent configuration entry by name
     */
    async getAgentConfigEntry(agentName: string): Promise<AgentConfigEntry | string | undefined> {
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
            return await fs.readJSON(defPath);
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
            `${agentName}.json`
        );
        try {
            return await fs.readJSON(agentConfigPath);
        } catch (_error) {
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

    /**
     * Update runtime LLM configuration for an agent
     * This updates the in-memory config but does not persist to disk
     */
    updateAgentLLMConfig(agentName: string, newConfigName: string): boolean {
        // Log available configs for debugging
        logger.info(`Available LLM configs: ${Array.from(this.llmConfigs.keys()).join(", ")}`);

        // Verify the new config exists
        const newConfig = this.resolveLLMConfig(newConfigName);
        if (!newConfig) {
            logger.error(`LLM config '${newConfigName}' not found`);
            logger.error(`Available configs: ${Array.from(this.llmConfigs.keys()).join(", ")}`);
            return false;
        }

        // Update the agent-specific mapping
        // This creates an agent-specific config that will be used by getLLMConfigForAgent
        this.llmConfigs.set(agentName, newConfig);
        logger.info(`Updated LLM config for agent '${agentName}' to '${newConfigName}'`);
        logger.info(`Agent ${agentName} will now use: ${newConfig.provider}/${newConfig.model}`);

        return true;
    }
}
