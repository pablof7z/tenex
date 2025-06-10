import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { NDKPrivateKeySigner, NDKEvent } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import { ndk } from "../ndk.js";
import { log } from "./utils/log.js";
import type { AgentConfig } from "../config.js";

/**
 * Load agents configuration from a file
 * @param configPath Path to agents.json file
 * @returns Agent configuration object
 */
export async function loadAgentsConfig(configPath: string): Promise<AgentConfig> {
    try {
        const content = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(content) as AgentConfig;
    } catch (err) {
        log(`WARN: Failed to load agents config from ${configPath}: ${err}`);
        return {};
    }
}

/**
 * Save agents configuration to a file
 * @param configPath Path to agents.json file
 * @param agents Agent configuration to save
 */
export async function saveAgentsConfig(configPath: string, agents: AgentConfig): Promise<void> {
    try {
        await fs.mkdir(dirname(configPath), { recursive: true });
        await fs.writeFile(configPath, JSON.stringify(agents, null, 2));
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
    projectName: string
): Promise<string> {
    // Load existing agents
    const agents = await loadAgentsConfig(agentsConfigPath);
    
    // If agent already exists, return its nsec
    if (agents[agentName]) {
        log(`INFO: Using existing agent '${agentName}'`);
        // Handle both old format (string) and new format (object)
        const agentData = agents[agentName];
        if (typeof agentData === 'string') {
            return agentData;
        } else {
            return agentData.nsec;
        }
    }
    
    // Create new agent
    log(`INFO: Creating new agent '${agentName}' for project '${projectName}'`);
    
    // Generate new nsec
    const signer = NDKPrivateKeySigner.generate();
    const nsec = signer.nsec;
    
    // Publish kind:0 event for the new agent
    try {
        const displayName = `${agentName} @ ${projectName}`;
        const name = `${agentName}-${projectName.toLowerCase().replace(/\s+/g, '-')}`;
        const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(displayName)}`;
        
        const profileEvent = new NDKEvent(ndk, {
            kind: 0,
            content: JSON.stringify({
                name: name,
                display_name: displayName,
                about: `AI agent ${agentName} for ${projectName} project`,
                picture: avatarUrl,
                created_at: Math.floor(Date.now() / 1000)
            }),
            tags: []
        });
        
        // Sign with the new agent's key
        await profileEvent.sign(signer);
        await profileEvent.publish();
        
        log(`INFO: Published kind:0 event for agent '${agentName}' with pubkey ${signer.pubkey}`);
    } catch (err) {
        log(`WARN: Failed to publish kind:0 event for agent: ${err}`);
        // Continue even if profile publish fails
    }
    
    // Save the new agent in the new format
    agents[agentName] = {
        nsec: nsec,
        name: displayName,
        model: "claude-3-5-sonnet-20241022"
    };
    await saveAgentsConfig(agentsConfigPath, agents);
    
    return nsec;
}

