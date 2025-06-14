import { readFile } from "node:fs/promises";
import path from "node:path";
import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import { EVENT_KINDS } from "@tenex/types";
import { logError, logInfo, logSuccess, logWarning } from "../../../shared/src/logger.js";
import {
    checkProjectExists,
    extractProjectIdentifierFromTag,
    initializeProject,
    toKebabCase,
} from "../../../shared/src/projects.js";
import type { Config } from "../config/config.js";
import type { ProcessManager } from "../utils/processManager.js";

interface AgentDefinition {
    name: string;
    description?: string;
    role?: string;
    instructions?: string;
    version?: number;
}

interface AgentConfigEntry {
    nsec: string;
    file?: string;
}

interface AgentsJsonConfig {
    [agentName: string]: string | AgentConfigEntry;
}

export async function handleProjectEvent(
    event: NDKEvent,
    config: Config,
    _ndk: NDK,
    processManager: ProcessManager
): Promise<void> {
    if (!config.projectsPath) {
        logError("Configuration error: projectsPath is not set");
        return;
    }

    // Extract project information from the event
    const projectTag = event.tagValue("a");
    if (!projectTag || !projectTag.startsWith(`${EVENT_KINDS.PROJECT}:`)) {
        // Not a project-related event
        return;
    }

    try {
        const projectIdentifier = extractProjectIdentifierFromTag(projectTag);
        const projectDTag = projectIdentifier; // This is the d-tag

        logInfo(`[${projectDTag}] Received event kind ${event.kind}`);

        // Check if project exists locally
        const projectInfo = await checkProjectExists(config.projectsPath, projectIdentifier);

        let projectPath: string;

        if (projectInfo.exists) {
            projectPath = projectInfo.path;
        } else {
            logWarning(`[${projectDTag}] Project not found locally at ${projectInfo.path}`);
            logInfo(`[${projectDTag}] Initializing project...`);

            try {
                // Extract naddr from the a-tag
                const parts = projectTag.split(":");
                if (parts.length >= 3) {
                    const kind = Number.parseInt(parts[0]);
                    const pubkey = parts[1];
                    const identifier = parts[2];

                    const projectNaddr = nip19.naddrEncode({
                        kind,
                        pubkey,
                        identifier,
                    });

                    projectPath = await initializeProject({
                        path: config.projectsPath,
                        naddr: projectNaddr,
                    });

                    logSuccess(`[${projectDTag}] Project initialized at ${projectPath}`);
                } else {
                    logError(`[${projectDTag}] Invalid project tag format`);
                    return;
                }
            } catch (err) {
                logError(
                    `[${projectDTag}] Failed to initialize project: ${err instanceof Error ? err.message : String(err)}`
                );
                return;
            }
        }

        // Check if project is already running
        if (!processManager.isProjectRunning(projectDTag)) {
            logInfo(`[${projectDTag}] Starting project for event kind ${event.kind}`);
            await processManager.startProject(projectDTag, projectPath);
        } else {
            logInfo(
                `[${projectDTag}] Project already running, event will be handled by running process`
            );
        }
    } catch (err) {
        logError(
            `Failed to handle project event: ${err instanceof Error ? err.message : String(err)}`
        );
    }
}

/**
 * Create NDKAgent configuration files from NDKAgent events (kind 4199)
 */
export async function handleAgentEvent(event: NDKEvent, config: Config): Promise<void> {
    if (event.kind !== EVENT_KINDS.AGENT_CONFIG) return;

    // Get project reference
    const projectTag = event.tagValue("a");
    if (!projectTag || !projectTag.startsWith(`${EVENT_KINDS.PROJECT}:`)) {
        logWarning("Agent event missing project 'a' tag");
        return;
    }

    try {
        const projectIdentifier = extractProjectIdentifierFromTag(projectTag);
        const projectInfo = await checkProjectExists(config.projectsPath, projectIdentifier);

        if (!projectInfo.exists) {
            logWarning(`Project ${projectInfo.name} not found for agent event`);
            return;
        }

        // Extract agent information
        const agentName = event.tagValue("title") || "unnamed";
        const agentConfig: AgentDefinition = {
            name: agentName,
            description: event.tagValue("description"),
            role: event.tagValue("role"),
            instructions: event.tagValue("instructions"),
            version: Number.parseInt(event.tagValue("version") || "1"),
        };

        // Save agent configuration
        const agentDir = path.join(projectInfo.path, ".tenex", "agents");
        const agentConfigPath = path.join(agentDir, `${event.id}.json`);

        // Create agents directory if it doesn't exist
        const fs = await import("node:fs/promises");
        await fs.mkdir(agentDir, { recursive: true });

        // Write agent configuration
        await fs.writeFile(agentConfigPath, JSON.stringify(agentConfig, null, 2));

        // Also ensure the agent has an nsec in agents.json
        const agentsJsonPath = path.join(projectInfo.path, ".tenex", "agents.json");
        let agents: AgentsJsonConfig = {};

        try {
            const agentsData = await fs.readFile(agentsJsonPath, "utf-8");
            agents = JSON.parse(agentsData);
        } catch (_err) {
            // agents.json might not exist yet
        }

        // Convert agent name to kebab-case
        const agentKey = toKebabCase(agentName);

        // If this agent doesn't have an nsec, generate one
        const agentEntry = agents[agentKey];
        let needsUpdate = false;
        let signer: NDKPrivateKeySigner;

        if (!agentEntry) {
            // Create new agent entry
            signer = NDKPrivateKeySigner.generate();
            agents[agentKey] = {
                nsec: signer.nsec,
                file: `${event.id}.json`,
            };
            needsUpdate = true;
            logInfo(
                `[${projectIdentifier}] Generated nsec for agent ${agentName} (as '${agentKey}')`
            );
        } else if (typeof agentEntry === "string") {
            // Old format - convert to new format
            signer = new NDKPrivateKeySigner(agentEntry);
            agents[agentKey] = {
                nsec: agentEntry,
                file: `${event.id}.json`,
            };
            needsUpdate = true;
            logInfo(`[${projectIdentifier}] Updated agent ${agentName} to new format`);
        } else {
            // New format - check if file reference needs updating
            signer = new NDKPrivateKeySigner(agentEntry.nsec);
            if (!agentEntry.file || agentEntry.file !== `${event.id}.json`) {
                agentEntry.file = `${event.id}.json`;
                needsUpdate = true;
                logInfo(`[${projectIdentifier}] Updated file reference for agent ${agentName}`);
            }
        }

        if (needsUpdate) {
            // Save updated agents.json
            await fs.writeFile(agentsJsonPath, JSON.stringify(agents, null, 2));

            // Publish kind:0 profile event for the new agent
            try {
                // Get project metadata to include in agent name
                const metadataPath = path.join(projectInfo.path, ".tenex", "metadata.json");
                let projectTitle = projectInfo.name;
                try {
                    const metadataContent = await fs.readFile(metadataPath, "utf-8");
                    const metadata = JSON.parse(metadataContent);
                    projectTitle = metadata.title || metadata.name || projectInfo.name;
                } catch (_err) {
                    // Use default if metadata not found
                }

                const agentDisplayName = `${agentKey} @ ${projectTitle}`;
                const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(agentDisplayName)}`;

                const profileEvent = new NDKEvent(undefined, {
                    kind: EVENT_KINDS.METADATA,
                    pubkey: signer.pubkey,
                    content: JSON.stringify({
                        name: agentDisplayName,
                        display_name: agentDisplayName,
                        about: agentConfig.description || `AI agent for ${projectTitle}`,
                        picture: avatarUrl,
                        created_at: Math.floor(Date.now() / 1000),
                    }),
                    tags: [],
                });

                await profileEvent.sign(signer);

                // Note: We can't publish here because we don't have an NDK instance
                // The profile will be published when the agent is first used
                logInfo(`[${projectIdentifier}] Agent profile prepared for ${agentDisplayName}`);
            } catch (err) {
                logWarning(
                    `[${projectIdentifier}] Could not prepare agent profile: ${err instanceof Error ? err.message : String(err)}`
                );
            }
        }

        logSuccess(`[${projectIdentifier}] Saved agent configuration for ${agentName}`);
    } catch (err) {
        logError(
            `Failed to handle agent event: ${err instanceof Error ? err.message : String(err)}`
        );
    }
}
