import NDK, { type NDKEvent } from "@nostr-dev-kit/ndk";
import type { ConfigData } from "./config";
import { log } from "./lib/utils/log.js";

interface AgentDefinition {
    eventId: string;
    name: string;
    description?: string;
    role?: string;
    instructions?: string;
    version: number;
    publishedAt?: number;
    publisher: string;
}

/**
 * Fetches an agent configuration from Nostr using its event ID
 * @param eventId The event ID of the NDKAgent (kind 4199)
 * @param relays The relay URLs to connect to
 * @returns The agent definition or null if not found
 */
export async function fetchAgentConfiguration(
    eventId: string,
    relays: string[]
): Promise<AgentDefinition | null> {
    try {
        log(`INFO: Fetching agent configuration for event ID: ${eventId}`);

        // Create a temporary NDK instance for fetching
        const tempNdk = new NDK({
            explicitRelayUrls: relays,
        });

        await tempNdk.connect();

        // Fetch the event
        const event = await tempNdk.fetchEvent(eventId);

        if (!event) {
            log(`WARN: Agent event ${eventId} not found`);
            return null;
        }

        if (event.kind !== 4199) {
            log(`WARN: Event ${eventId} is not an NDKAgent event (kind 4199)`);
            return null;
        }

        // Parse the agent definition from tags
        const agentDef = parseAgentEvent(event);

        log(`INFO: Successfully fetched agent configuration: ${agentDef.name}`);

        return agentDef;
    } catch (error) {
        log(
            `ERROR: Failed to fetch agent configuration: ${error instanceof Error ? error.message : String(error)}`
        );
        return null;
    }
}

/**
 * Parses an NDKAgent event (kind 4199) into an AgentDefinition
 * @param event The NDKEvent to parse
 * @returns The parsed agent definition
 */
function parseAgentEvent(event: NDKEvent): AgentDefinition {
    const getTag = (name: string): string | undefined => {
        const tag = event.tags.find((t) => t[0] === name);
        return tag ? tag[1] : undefined;
    };

    return {
        eventId: event.id,
        name: getTag("title") || "Unknown Agent",
        description: getTag("description"),
        role: getTag("role"),
        instructions: getTag("instructions"),
        version: Number.parseInt(getTag("version") || "1", 10),
        publishedAt: event.created_at,
        publisher: event.pubkey,
    };
}

/**
 * Loads agent configuration and updates the config object
 * @param config The configuration object to update
 * @returns The updated configuration
 */
export async function loadAgentConfiguration(
    config: ConfigData
): Promise<ConfigData> {
    if (!config.agentEventId) {
        return config;
    }

    const agentDef = await fetchAgentConfiguration(
        config.agentEventId,
        config.relays
    );

    if (agentDef) {
        config.agentName = agentDef.name;
        log(`INFO: Loaded agent configuration: ${agentDef.name}`);

        // Log additional agent details
        if (agentDef.description) {
            log(`INFO: Agent description: ${agentDef.description}`);
        }
        if (agentDef.role) {
            log(`INFO: Agent role: ${agentDef.role}`);
        }
    }

    return config;
}
