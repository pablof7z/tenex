import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import { logError, logInfo, logWarning } from "../logger.js";
import { getNDK } from "../nostr.js";
import { getErrorMessage } from "@tenex/types/utils";
/**
 * Convert agent name to kebab-case for use as key in agents.json
 * Examples: "Christ" -> "christ", "Hello World" -> "hello-world"
 */
export function toKebabCase(name) {
    return name.toLowerCase().replace(/\s+/g, "-");
}
/**
 * Load agents configuration from a file
 * Handles both legacy (string) and new (object) formats
 */
export async function loadAgentsConfig(configPath) {
    try {
        const content = await readFile(configPath, "utf-8");
        const rawConfig = JSON.parse(content);
        // Convert legacy format to new format
        const agents = {};
        for (const [key, value] of Object.entries(rawConfig)) {
            if (typeof value === "string") {
                // Legacy format: just nsec string
                agents[key] = { nsec: value };
            }
            else {
                // New format: already an object
                agents[key] = value;
            }
        }
        return agents;
    }
    catch (err) {
        if (err instanceof Error && 'code' in err && err.code === "ENOENT") {
            return {};
        }
        logWarning(`Failed to load agents config from ${configPath}: ${getErrorMessage(err)}`);
        return {};
    }
}
/**
 * Save agents configuration to a file
 */
export async function saveAgentsConfig(configPath, agents) {
    try {
        await mkdir(path.dirname(configPath), { recursive: true });
        await writeFile(configPath, JSON.stringify(agents, null, 2));
        logInfo(`Saved agents config to ${configPath}`);
    }
    catch (err) {
        logError(`Failed to save agents config to ${configPath}: ${getErrorMessage(err)}`);
        throw err;
    }
}
/**
 * Generate avatar URL for an agent
 */
export function generateAgentAvatarUrl(displayName) {
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(displayName)}`;
}
/**
 * Create agent profile data
 */
export function createAgentProfile(agentName, projectName, isDefault = false) {
    const displayName = isDefault ? projectName : `${agentName} @ ${projectName}`;
    const about = `${isDefault ? "Default" : agentName} AI agent for ${projectName} project`;
    return {
        name: displayName,
        display_name: displayName,
        about,
        picture: generateAgentAvatarUrl(displayName),
        created_at: Math.floor(Date.now() / 1000),
    };
}
/**
 * Publish agent profile to Nostr
 */
export async function publishAgentProfile(nsec, agentName, projectName, isDefault = false) {
    try {
        const ndk = await getNDK();
        const signer = new NDKPrivateKeySigner(nsec);
        const profile = createAgentProfile(agentName, projectName, isDefault);
        const profileEvent = new NDKEvent(ndk, {
            kind: 0,
            pubkey: signer.pubkey,
            content: JSON.stringify(profile),
            tags: [],
        });
        await profileEvent.sign(signer);
        await profileEvent.publish();
        // Profile publishing logged by caller
    }
    catch (err) {
        logWarning(`Failed to publish agent profile: ${getErrorMessage(err)}`);
    }
}
/**
 * Publish agent request event (kind 3199) to request human acknowledgment
 */
export async function publishAgentRequest(agentSigner, agentName, projectNaddr, projectAuthor, agentEventFile) {
    try {
        const ndk = await getNDK();
        // Find the agent's NDKAgent event (kind 4199) if available
        let agentEventId;
        if (agentEventFile) {
            // Extract event ID from filename (e.g., "{event-id}.json")
            const match = agentEventFile.match(/^([a-f0-9]+)\.json$/);
            if (match) {
                agentEventId = match[1];
            }
        }
        const tags = [
            ["p", projectAuthor],
            ["a", projectNaddr],
            ["name", agentName],
        ];
        if (agentEventId) {
            tags.push(["e", agentEventId]);
        }
        const agentRequestEvent = new NDKEvent(ndk, {
            kind: 3199,
            pubkey: agentSigner.pubkey,
            content: "",
            tags: tags,
        });
        await agentRequestEvent.sign(agentSigner);
        await agentRequestEvent.publish();
        logInfo(`Published kind:3199 agent request for '${agentName}'`);
        logInfo("Agent request event details:");
        logInfo(JSON.stringify(agentRequestEvent.rawEvent(), null, 2));
    }
    catch (err) {
        logWarning(`Failed to publish agent request: ${getErrorMessage(err)}`);
    }
}
/**
 * Get or create an agent signer
 */
export async function getOrCreateAgentSigner(projectPath, agentSlug = "default") {
    const agentsPath = path.join(projectPath, ".tenex", "agents.json");
    const agents = await loadAgentsConfig(agentsPath);
    let agentEntry = agents[agentSlug];
    let isNew = false;
    if (!agentEntry) {
        logInfo(`Agent '${agentSlug}' not found, creating new agent...`);
        isNew = true;
        // Generate new private key
        const newSigner = NDKPrivateKeySigner.generate();
        const nsec = newSigner.nsec;
        // Get project metadata for naming and naddr
        let projectName = "Project";
        let projectNaddr;
        let projectAuthor;
        try {
            const metadataPath = path.join(projectPath, ".tenex", "metadata.json");
            const metadata = JSON.parse(await readFile(metadataPath, "utf-8"));
            projectName = metadata.name || metadata.title || "Project";
            projectNaddr = metadata.projectNaddr;
            // Parse the naddr to get the project author's pubkey
            if (projectNaddr) {
                try {
                    const decoded = nip19.decode(projectNaddr);
                    if (decoded.type === "naddr" && decoded.data) {
                        projectAuthor = decoded.data.pubkey;
                    }
                }
                catch (err) {
                    logWarning(`Failed to decode project naddr: ${getErrorMessage(err)}`);
                }
            }
        }
        catch (err) {
            logWarning(`Could not load project metadata: ${getErrorMessage(err)}`);
        }
        // Save new agent
        agentEntry = { nsec };
        agents[agentSlug] = agentEntry;
        await saveAgentsConfig(agentsPath, agents);
        // Only publish profile if this is truly a runtime-created agent
        // (not during project initialization where profiles are bulk-published)
        const isRuntimeCreation = !process.env.TENEX_PROJECT_INIT;
        if (isRuntimeCreation) {
            await publishAgentProfile(nsec, agentSlug, projectName, agentSlug === "default");
        }
        // Publish kind 3199 event to request human acknowledgment
        if (projectNaddr && projectAuthor) {
            await publishAgentRequest(newSigner, agentSlug, projectNaddr, projectAuthor, agentEntry.file);
        }
    }
    const signer = new NDKPrivateKeySigner(agentEntry.nsec);
    return {
        signer,
        nsec: agentEntry.nsec,
        isNew,
        configFile: agentEntry.file,
    };
}
/**
 * Update or add an agent to agents.json
 */
export async function updateAgentConfig(projectPath, agentName, nsec, configFile) {
    const agentsPath = path.join(projectPath, ".tenex", "agents.json");
    const agents = await loadAgentsConfig(agentsPath);
    const agentKey = toKebabCase(agentName);
    agents[agentKey] = {
        nsec,
        ...(configFile && { file: configFile }),
    };
    await saveAgentsConfig(agentsPath, agents);
}
/**
 * Fetch and save agent definitions from Nostr
 */
export async function fetchAndSaveAgentDefinitions(agentEventIds, tenexDir, agentsConfig) {
    logInfo(`Fetching ${agentEventIds.length} agent definitions...`);
    const agentsDir = path.join(tenexDir, "agents");
    await mkdir(agentsDir, { recursive: true });
    const ndk = await getNDK();
    for (const agentEventId of agentEventIds) {
        try {
            const agentEvent = await ndk.fetchEvent(agentEventId);
            if (agentEvent && agentEvent.kind === 4199) {
                const agentName = agentEvent.tagValue("title") || "unnamed";
                const agentConfig = {
                    eventId: agentEventId,
                    name: agentName,
                    description: agentEvent.tagValue("description"),
                    role: agentEvent.tagValue("role"),
                    instructions: agentEvent.tagValue("instructions"),
                    version: Number.parseInt(agentEvent.tagValue("version") || "1"),
                    publishedAt: agentEvent.created_at,
                    publisher: agentEvent.pubkey,
                };
                // Save agent configuration
                const agentConfigPath = path.join(agentsDir, `${agentEventId}.json`);
                await writeFile(agentConfigPath, JSON.stringify(agentConfig, null, 2));
                logInfo(`Saved agent definition: ${agentName} (${agentEventId})`);
                // Generate nsec for this agent if not exists
                const agentKey = toKebabCase(agentName);
                if (!agentsConfig[agentKey]) {
                    const agentSigner = NDKPrivateKeySigner.generate();
                    if (!agentSigner.privateKey) {
                        throw new Error(`Failed to generate private key for agent ${agentName}`);
                    }
                    const agentPrivateKeyBytes = Buffer.from(agentSigner.privateKey, "hex");
                    agentsConfig[agentKey] = {
                        nsec: nip19.nsecEncode(agentPrivateKeyBytes),
                        file: `${agentEventId}.json`,
                    };
                    logInfo(`Generated nsec for agent '${agentName}' as '${agentKey}'`);
                }
            }
            else {
                logWarning(`Agent event ${agentEventId} not found or invalid kind`);
            }
        }
        catch (err) {
            logWarning(`Failed to fetch agent ${agentEventId}: ${getErrorMessage(err)}`);
        }
    }
}
