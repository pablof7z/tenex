import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getNDK } from "@/nostr/ndkClient";
import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { logError, logInfo, logWarning } from "@tenex/shared";
import type {
    AgentDefinition,
    AgentProfile,
    AgentSignerResult,
    AgentsJson,
    LegacyAgentsJson,
} from "@tenex/types/agents";
import { getErrorMessage } from "@tenex/types/utils";
import { nip19 } from "nostr-tools";

/**
 * Convert agent name to kebab-case for use as key in agents.json
 * Examples: "Christ" -> "christ", "Hello World" -> "hello-world"
 */
export function toKebabCase(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

/**
 * Read agents.json file from a project
 * Handles both legacy (string values) and new format (object values)
 */
export async function readAgentsJson(projectPath: string): Promise<AgentsJson> {
    const agentsPath = path.join(projectPath, ".tenex", "agents.json");
    try {
        const content = await readFile(agentsPath, "utf-8");
        const data = JSON.parse(content) as AgentsJson | LegacyAgentsJson;

        // Convert legacy format to new format if needed
        const agents: AgentsJson = {};
        for (const [name, value] of Object.entries(data)) {
            if (typeof value === "string") {
                // Legacy format: just the nsec
                agents[name] = { nsec: value };
            } else {
                // New format: object with nsec and optional file
                agents[name] = value;
            }
        }

        return agents;
    } catch (error: unknown) {
        logError(`Failed to read agents.json: ${getErrorMessage(error)}`);
        throw error;
    }
}

/**
 * Get the signer for a specific agent
 */
export async function getAgentSigner(
    projectPath: string,
    agentName: string
): Promise<AgentSignerResult> {
    const agents = await readAgentsJson(projectPath);
    const agentKey = toKebabCase(agentName);
    const agentConfig = agents[agentKey];

    if (!agentConfig) {
        throw new Error(`Agent "${agentName}" not found in agents.json`);
    }

    const signer = new NDKPrivateKeySigner(agentConfig.nsec);
    return {
        signer,
        nsec: agentConfig.nsec,
        isNew: false,
        configFile: agentConfig.file,
    };
}

/**
 * Create agent profile for Nostr kind 0 event
 */
export function createAgentProfile(
    agentName: string,
    projectName: string,
    isDefault = false
): AgentProfile {
    const displayName = isDefault ? `${projectName} Agent` : `${agentName} (${projectName})`;
    const about = isDefault
        ? `Default AI agent for ${projectName}`
        : `${agentName} AI agent for ${projectName}`;

    return {
        name: agentName,
        display_name: displayName,
        about,
        picture: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${agentName}-${projectName}`,
        banner: `https://api.dicebear.com/7.x/shapes/svg?seed=${projectName}`,
        nip05: `${toKebabCase(agentName)}@tenex.bot`,
        lud16: `${toKebabCase(agentName)}@tenex.bot`,
        website: "https://tenex.bot",
    };
}

/**
 * Publish agent profile (kind 0) to Nostr
 */
export async function publishAgentProfile(
    nsec: string,
    agentName: string,
    projectName: string,
    isDefault = false
): Promise<void> {
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
    } catch (err: unknown) {
        logWarning(`Failed to publish agent profile: ${getErrorMessage(err)}`);
    }
}

/**
 * Publish agent request event (kind 3199) to request human acknowledgment
 */
export async function publishAgentRequest(
    agentSigner: NDKPrivateKeySigner,
    agentName: string,
    projectNaddr: string,
    projectAuthor: string,
    agentEventFile?: string
): Promise<void> {
    try {
        const ndk = await getNDK();

        // Fetch the project event to tag it properly
        const projectEvent = await ndk.fetchEvent(projectNaddr);
        if (!projectEvent) {
            throw new Error(`Project event not found: ${projectNaddr}`);
        }

        // Import NDKAgentRequest from shared
        const { NDKAgentRequest } = await import("@tenex/shared");

        // Create the agent request event
        const requestEvent = new NDKAgentRequest(ndk);
        requestEvent.pubkey = agentSigner.pubkey;
        requestEvent.content = `Requesting acknowledgment as ${agentName} agent for this project.`;

        // Set the agent name
        requestEvent.agentName = agentName;

        // Tag the project event properly
        requestEvent.tagProject(projectEvent);

        // Tag the project author
        requestEvent.tagUser(projectAuthor);

        // Add alt tag
        requestEvent.tags.push(["alt", `Agent request for ${agentName}`]);

        // Find the agent's NDKAgent event (kind 4199) if available
        if (agentEventFile) {
            // Extract event ID from filename (e.g., "{event-id}.json")
            const match = agentEventFile.match(/^([a-f0-9]+)\.json$/);
            if (match) {
                requestEvent.agentEventId = match[1];
            }
        }

        await requestEvent.sign(agentSigner);
        await requestEvent.publish();

        logInfo(`Published agent request for ${agentName}`);
    } catch (err: unknown) {
        logWarning(`Failed to publish agent request: ${getErrorMessage(err)}`);
    }
}

/**
 * Fetch agent definitions from Nostr and save them locally
 */
export async function fetchAndSaveAgentDefinitions(
    projectPath: string,
    eventIds: string[]
): Promise<void> {
    const ndk = await getNDK();
    const agentsDir = path.join(projectPath, ".tenex", "agents");

    // Create agents directory
    await mkdir(agentsDir, { recursive: true });

    for (const eventId of eventIds) {
        try {
            logInfo(`Fetching agent definition: ${eventId}`);

            // Fetch the event
            const event = await ndk.fetchEvent(eventId);
            if (!event) {
                logWarning(`Agent event not found: ${eventId}`);
                continue;
            }

            // Extract agent definition from event
            const titleTag = event.tags.find((tag) => tag[0] === "title");
            const descTag = event.tags.find((tag) => tag[0] === "description");
            const roleTag = event.tags.find((tag) => tag[0] === "role");
            const instructionsTag = event.tags.find((tag) => tag[0] === "instructions");
            const versionTag = event.tags.find((tag) => tag[0] === "version");

            const agentDef: AgentDefinition = {
                id: event.id,
                pubkey: event.pubkey,
                name: titleTag?.[1] || "Unknown Agent",
                description: descTag?.[1] || "",
                role: roleTag?.[1] || "",
                instructions: instructionsTag?.[1] || "",
                version: versionTag?.[1] || "1.0.0",
                createdAt: event.created_at || Math.floor(Date.now() / 1000),
            };

            // Save to file
            const filename = path.join(agentsDir, `${eventId}.json`);
            await writeFile(filename, JSON.stringify(agentDef, null, 2));

            logInfo(`Saved agent definition: ${agentDef.name}`);
        } catch (error: unknown) {
            logError(`Failed to fetch agent ${eventId}: ${getErrorMessage(error)}`);
        }
    }
}
