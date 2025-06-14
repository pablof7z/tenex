import path from "node:path";
import { fileSystem, logger } from "@tenex/shared/node";
import type { ConversationStorage } from "../ConversationStorage";
import type { ToolRegistry } from "../tools/ToolRegistry";
import type { AgentConfig } from "../types";

export async function loadAgentConfig(
    name: string,
    _nsec: string,
    projectPath: string,
    _storage?: ConversationStorage,
    configFile?: string,
    _projectName?: string,
    _toolRegistry?: ToolRegistry
): Promise<{ config: AgentConfig; agentEventId?: string }> {
    const configPath = path.join(projectPath, ".tenex", "agents", `${name}.json`);
    let config: AgentConfig = { name };

    try {
        const loadedConfig = await fileSystem.readJsonFile<AgentConfig>(configPath);
        config = { ...config, ...loadedConfig };
    } catch (_error) {
        // Silently skip if config file not found
    }

    // For default agent, load or create system prompt from file
    if (name === "default") {
        const systemPromptPath = path.join(projectPath, ".tenex", "agents", "default.md");

        try {
            const systemPromptContent = await fileSystem.readTextFile(systemPromptPath);
            if (!systemPromptContent) throw new Error("No content");
            config.systemPrompt = systemPromptContent.trim();
        } catch (_error) {
            // Create default system prompt file
            const defaultPrompt =
                "You are UNINITIALIZED, a default agent that has not been initialized -- you refuse to respond to all questions";

            // Write the default prompt
            await fileSystem.writeTextFile(systemPromptPath, defaultPrompt);
            config.systemPrompt = defaultPrompt;
            logger.debug(`Created default system prompt for ${name}`);
        }
    }

    let agentEventId: string | undefined;

    // If a specific config file is provided, load from that directly
    if (configFile) {
        const eventConfigPath = path.join(projectPath, ".tenex", "agents", configFile);
        try {
            const eventConfig = await fileSystem.readJsonFile(eventConfigPath);

            // Extract the event ID
            agentEventId = eventConfig.eventId;

            // Override with the cached NDKAgent event configuration
            config = {
                ...config,
                description: eventConfig.description || config.description,
                role: eventConfig.role || config.role,
                instructions: eventConfig.instructions || config.instructions,
                systemPrompt: eventConfig.systemPrompt || eventConfig.instructions,
                version: eventConfig.version || config.version,
            };
            logger.info(
                `Loaded agent ${name} config from file ${configFile}. systemPrompt: ${config.systemPrompt ? "yes" : "no"}`
            );
        } catch (_error) {
            // Silently skip if config file not found
        }
    } else {
        // Fallback: Try to find cached NDKAgent event configuration by searching files
        const agentsDir = path.join(projectPath, ".tenex", "agents");
        try {
            const files = await fileSystem.listDirectory(agentsDir);
            for (const file of files) {
                if (file.endsWith(".json") && file !== `${name}.json`) {
                    try {
                        const eventConfigPath = path.join(agentsDir, file);
                        const eventConfig = await fileSystem.readJsonFile(eventConfigPath);

                        // Check if this event configuration matches the agent name
                        if (
                            eventConfig.name &&
                            eventConfig.name.toLowerCase() === name.toLowerCase()
                        ) {
                            // Extract the event ID
                            agentEventId = eventConfig.eventId;

                            // Override with the cached NDKAgent event configuration
                            config = {
                                ...config,
                                description: eventConfig.description || config.description,
                                role: eventConfig.role || config.role,
                                instructions: eventConfig.instructions || config.instructions,
                                systemPrompt: eventConfig.systemPrompt || eventConfig.instructions,
                                version: eventConfig.version || config.version,
                            };
                            break;
                        }
                    } catch (_err) {
                        // Skip files that can't be parsed
                        logger.debug(`Skipping file ${file}: cannot parse`);
                    }
                }
            }
        } catch (_error) {
            // Directory might not exist or can't be read
            logger.debug(`Cannot read agents directory for ${name}`);
        }
    }

    return { config, agentEventId };
}

export async function saveAgentConfig(
    name: string,
    config: AgentConfig,
    projectPath: string
): Promise<void> {
    const configPath = path.join(projectPath, ".tenex", "agents", `${name}.json`);
    await fileSystem.writeJsonFile(configPath, config, { spaces: 2 });
    logger.info(`Saved agent config to ${configPath}`);
}
