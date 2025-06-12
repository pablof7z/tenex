import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import type { AgentConfig } from "../config.js";
import { ndk } from "../ndk.js";
import { log } from "./utils/log.js";

// Updated agent entry structure
interface AgentConfigEntry {
	nsec: string;
	file?: string;
}

interface AgentsJsonConfig {
	[agentName: string]: string | AgentConfigEntry;
}

/**
 * Load agents configuration from a file
 * @param configPath Path to agents.json file
 * @returns Agent configuration object (simplified format for MCP)
 */
export async function loadAgentsConfig(
	configPath: string,
): Promise<AgentConfig> {
	try {
		const content = await fs.readFile(configPath, "utf-8");
		const rawConfig = JSON.parse(content) as AgentsJsonConfig;

		// Convert to simple AgentConfig format (just name -> nsec mapping)
		const config: AgentConfig = {};
		for (const [name, configOrNsec] of Object.entries(rawConfig)) {
			if (typeof configOrNsec === "string") {
				// Old format: just nsec string
				config[name] = configOrNsec;
			} else {
				// New format: object with nsec and optional file
				config[name] = configOrNsec.nsec;
			}
		}

		return config;
	} catch (err) {
		log(`WARN: Failed to load agents config from ${configPath}: ${err}`);
		return {};
	}
}

/**
 * Save agents configuration to a file
 * @param configPath Path to agents.json file
 * @param agents Agent configuration to save (simple format)
 * @param preserveExisting If true, preserve existing file references
 */
export async function saveAgentsConfig(
	configPath: string,
	agents: AgentConfig,
	preserveExisting = true,
): Promise<void> {
	try {
		const configToSave: AgentsJsonConfig = {};

		if (preserveExisting) {
			// Try to load existing config to preserve file references
			try {
				const content = await fs.readFile(configPath, "utf-8");
				const existingConfig = JSON.parse(content) as AgentsJsonConfig;

				// Merge with existing config, preserving file references
				for (const [name, nsec] of Object.entries(agents)) {
					const existing = existingConfig[name];
					if (existing && typeof existing === "object" && existing.file) {
						// Preserve existing file reference
						configToSave[name] = { nsec, file: existing.file };
					} else {
						// New agent or old format - just save nsec in new format
						configToSave[name] = { nsec };
					}
				}
			} catch {
				// No existing config or error reading - just save as new format
				for (const [name, nsec] of Object.entries(agents)) {
					configToSave[name] = { nsec };
				}
			}
		} else {
			// Just save as new format without preserving
			for (const [name, nsec] of Object.entries(agents)) {
				configToSave[name] = { nsec };
			}
		}

		await fs.mkdir(dirname(configPath), { recursive: true });
		await fs.writeFile(configPath, JSON.stringify(configToSave, null, 2));
		log(`INFO: Saved agents config to ${configPath}`);
	} catch (err) {
		log(`ERROR: Failed to save agents config to ${configPath}: ${err}`);
		throw err;
	}
}

/**
 * Get or create an agent's nsec
 * @param agentsConfigPath Path to agents.json file
 * @param agentName Name of the agent
 * @param projectName Name of the project (for kind:0 event)
 * @returns The agent's nsec
 */
export async function getOrCreateAgentNsec(
	agentsConfigPath: string,
	agentName: string,
	projectName: string,
): Promise<string> {
	// Load existing agents
	const agents = await loadAgentsConfig(agentsConfigPath);

	// If agent already exists, return its nsec
	if (agents[agentName]) {
		log(`INFO: Using existing agent '${agentName}'`);
		return agents[agentName];
	}

	// Create new agent
	log(`INFO: Creating new agent '${agentName}' for project '${projectName}'`);

	// Generate new nsec
	const signer = NDKPrivateKeySigner.generate();
	const nsec = signer.nsec;

	// Publish kind:0 event for the new agent
	try {
		const displayName = `${agentName} @ ${projectName}`;
		const name = `${agentName}-${projectName.toLowerCase().replace(/\s+/g, "-")}`;
		const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(displayName)}`;

		const profileEvent = new NDKEvent(ndk, {
			kind: 0,
			content: JSON.stringify({
				name: name,
				display_name: displayName,
				about: `AI agent ${agentName} for ${projectName} project`,
				picture: avatarUrl,
				created_at: Math.floor(Date.now() / 1000),
			}),
			tags: [],
		});

		// Sign with the new agent's key
		await profileEvent.sign(signer);
		await profileEvent.publish();

		log(
			`INFO: Published kind:0 event for agent '${agentName}' with pubkey ${signer.pubkey}`,
		);
	} catch (err) {
		log(`WARN: Failed to publish kind:0 event for agent: ${err}`);
		// Continue even if profile publish fails
	}

	// Save the new agent as just the nsec string
	agents[agentName] = nsec;
	await saveAgentsConfig(agentsConfigPath, agents);

	return nsec;
}
