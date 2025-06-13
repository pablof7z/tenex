import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "../../logger";
import type { ConversationStorage } from "../ConversationStorage";
import type { ToolRegistry } from "../tools/ToolRegistry";
import type { AgentConfig } from "../types";

export async function loadAgentConfig(
	name: string,
	nsec: string,
	projectPath: string,
	storage?: ConversationStorage,
	configFile?: string,
	projectName?: string,
	toolRegistry?: ToolRegistry,
): Promise<{ config: AgentConfig; agentEventId?: string }> {
	const configPath = path.join(projectPath, ".tenex", "agents", `${name}.json`);
	let config: AgentConfig = { name };

	try {
		const configData = await fs.readFile(configPath, "utf-8");
		const loadedConfig = JSON.parse(configData);
		config = { ...config, ...loadedConfig };
	} catch (error) {
		// Silently skip if config file not found
	}

	// For default agent, load or create system prompt from file
	if (name === "default") {
		const systemPromptPath = path.join(
			projectPath,
			".tenex",
			"agents",
			"default.md",
		);

		try {
			const systemPromptContent = await fs.readFile(systemPromptPath, "utf-8");
			config.systemPrompt = systemPromptContent.trim();
		} catch (error) {
			// Create default system prompt file
			const defaultPrompt =
				"You are UNINITIALIZED, a default agent that has not been initialized -- you refuse to respond to all questions";

			// Ensure agents directory exists
			await fs.mkdir(path.dirname(systemPromptPath), { recursive: true });

			// Write the default prompt
			await fs.writeFile(systemPromptPath, defaultPrompt);
			config.systemPrompt = defaultPrompt;
			logger.debug(`Created default system prompt for ${name}`);
		}
	}

	let agentEventId: string | undefined;

	// If a specific config file is provided, load from that directly
	if (configFile) {
		const eventConfigPath = path.join(
			projectPath,
			".tenex",
			"agents",
			configFile,
		);
		try {
			const eventConfigData = await fs.readFile(eventConfigPath, "utf-8");
			const eventConfig = JSON.parse(eventConfigData);

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
				`Loaded agent ${name} config from file ${configFile}. systemPrompt: ${config.systemPrompt ? "yes" : "no"}`,
			);
		} catch (error) {
			// Silently skip if config file not found
		}
	} else {
		// Fallback: Try to find cached NDKAgent event configuration by searching files
		const agentsDir = path.join(projectPath, ".tenex", "agents");
		try {
			const files = await fs.readdir(agentsDir);
			for (const file of files) {
				if (file.endsWith(".json") && file !== `${name}.json`) {
					try {
						const eventConfigPath = path.join(agentsDir, file);
						const eventConfigData = await fs.readFile(eventConfigPath, "utf-8");
						const eventConfig = JSON.parse(eventConfigData);

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
								systemPrompt:
									eventConfig.systemPrompt || eventConfig.instructions,
								version: eventConfig.version || config.version,
							};
							break;
						}
					} catch (err) {
						// Skip files that can't be parsed
						logger.debug(`Skipping file ${file}: cannot parse`);
					}
				}
			}
		} catch (error) {
			// Directory might not exist or can't be read
			logger.debug(`Cannot read agents directory for ${name}`);
		}
	}

	return { config, agentEventId };
}

export async function saveAgentConfig(
	name: string,
	config: AgentConfig,
	projectPath: string,
): Promise<void> {
	const configPath = path.join(projectPath, ".tenex", "agents", `${name}.json`);
	await fs.mkdir(path.dirname(configPath), { recursive: true });
	await fs.writeFile(configPath, JSON.stringify(config, null, 2));
	logger.info(`Saved agent config to ${configPath}`);
}
