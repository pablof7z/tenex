import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"; // Reverting to original path with .js
import { NDKEvent, NDKPrivateKeySigner, type NDKTag } from "@nostr-dev-kit/ndk";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { z } from "zod";
import { createCommit, hasUncommittedChanges } from "../lib/git.js";
import { getOrCreateAgentNsec } from "../lib/agents.js";
import { log } from "../lib/utils/log.js"; // Use the correct log import
import { ndk } from "../ndk.js"; // ndk instance should have the signer configured
import { getConfig } from "../config.js";

/**
 * Publish a note to Nostr using the globally configured signer.
 * @param content The content of the note to publish
 * @returns Publication results
 */
export async function publishNote(
    content: string,
    taskId?: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    return await publishToNostr(content, taskId);
}

/**
 * Publish a task status update to Nostr with confidence level.
 * @param content The content of the note to publish
 * @param taskId The task ID to tag
 * @param confidenceLevel Confidence level (1-10) where 10 is very confident and 1 is very confused
 * @param title Short title for the status update (used as git commit message)
 * @param agentName The name of the agent/mode publishing the update (e.g. "code", "planner", "debugger")
 * @returns Publication results
 */
export async function publishTaskStatusUpdate(
    content: string,
    taskId: string,
    confidenceLevel: number,
    title: string,
    agentName: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    let commitHash: string | undefined = undefined;

    // Handle git operations
    try {
        // Check for uncommitted changes
        const hasChanges = await hasUncommittedChanges();
        if (hasChanges) {
            log(`INFO: Found uncommitted changes, creating commit with title: "${title}"`);
            const hash = await createCommit(title);
            if (hash) {
                commitHash = hash;
                log(`INFO: Created commit with hash: ${commitHash}`);
            }
        } else {
            log("INFO: No uncommitted changes found, skipping git commit");
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`WARN: Git operation failed: ${errorMessage}. Continuing with nostr publishing.`);
        // Continue with nostr publishing even if git operations fail
    }

    return await publishToNostr(content, taskId, confidenceLevel, commitHash, agentName);
}

/**
 * Common function to publish notes to Nostr with optional confidence level.
 * @param content The content of the note to publish
 * @param taskId The task ID to tag (optional)
 * @param confidenceLevel Confidence level (optional)
 * @param commitHash Git commit hash (optional)
 * @param agentName The name of the agent/mode publishing (optional)
 * @returns Publication results
 */
async function publishToNostr(
    content: string,
    taskId?: string,
    confidenceLevel?: number,
    commitHash?: string,
    agentName?: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    log(
        `INFO: Publishing note with content type: ${typeof content}, value: "${content ? content.substring(0, 50) : "undefined"}..."`,
    );

    const taskFilePath = taskId ? path.join(os.homedir(), ".tenex", "tasks", taskId) : undefined;
    let previousEventId: string | undefined = undefined;
    let effectiveAgentName: string | undefined = undefined;

    try {
        // Ensure NDK is ready and connected
        if (!ndk) {
            throw new Error("NDK instance is not initialized.");
        }
        await ndk.connect(); // Ensure connection before publishing

        // Get the appropriate signer
        const config = await getConfig();
        let signer: NDKSigner | undefined;
        effectiveAgentName = agentName;
        
        // Determine which signer to use
        if (config.agentsConfigPath && config.agents) {
            // We're in agent mode
            if (!effectiveAgentName) {
                // No agent name provided, use 'default' or 'claude-code' if available
                if (config.agents.default) {
                    effectiveAgentName = 'default';
                } else if (config.agents['claude-code']) {
                    effectiveAgentName = 'claude-code';
                } else {
                    // Use the first available agent
                    const agentNames = Object.keys(config.agents);
                    if (agentNames.length > 0) {
                        effectiveAgentName = agentNames[0];
                    }
                }
            }
            
            if (effectiveAgentName) {
                // Extract project name from metadata.json in the same directory
                const projectMetadataPath = path.join(path.dirname(config.agentsConfigPath), 'metadata.json');
                let projectName = 'Unknown Project';
                try {
                    const metadataContent = await fs.readFile(projectMetadataPath, 'utf-8');
                    const metadata = JSON.parse(metadataContent);
                    projectName = metadata.title || metadata.name || projectName;
                } catch (err) {
                    log(`WARN: Failed to read project metadata: ${err}`);
                }
                
                // Get or create agent nsec
                const agentNsec = await getOrCreateAgentNsec(config.agentsConfigPath, effectiveAgentName, projectName);
                signer = new NDKPrivateKeySigner(agentNsec);
                log(`INFO: Using agent '${effectiveAgentName}' for publishing`);
            }
        } else if (ndk.signer) {
            // Legacy mode - use global signer
            signer = ndk.signer;
            log(`INFO: Using legacy single-signer mode for publishing`);
        }
        
        if (!signer) {
            throw new Error("No signer available for publishing. Ensure agent configuration or NSEC is provided.");
        }

        // If taskId is provided, try to read the previous event ID
        if (taskFilePath) {
            try {
                previousEventId = await fs.readFile(taskFilePath, "utf-8");
                log(`INFO: Found previous event ID ${previousEventId} for task ${taskId}`);
            } catch (error: unknown) {
                // Check if it's a Node.js file system error
                if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
                    log(`INFO: No previous event file found for task ${taskId}.`);
                } else if (error instanceof Error) {
                    log(`WARN: Error reading task file ${taskFilePath}: ${error.message}`);
                } else {
                    log(`WARN: Unknown error reading task file ${taskFilePath}: ${String(error)}`);
                }
            }
        }

        // Create the event
        // Prepare tags
        const tags: NDKTag[] = [];
        if (taskId) tags.push(["e", taskId, "", "task"]);

        if (previousEventId) {
            // Tag the previous event in the sequence for this task
            tags.push(["e", previousEventId]);
            log(`INFO: Tagging previous event ${previousEventId}`);
        }

        // Add confidence level tag if provided
        if (confidenceLevel !== undefined) {
            // Ensure confidence level is within valid range
            const normalizedConfidence = Math.max(1, Math.min(10, confidenceLevel));
            tags.push(["confidence", normalizedConfidence.toString()]);
            log(`INFO: Adding confidence level tag: ${normalizedConfidence}`);
        }

        // Add commit hash tag if provided
        if (commitHash) {
            tags.push(["commit", commitHash]);
            log(`INFO: Adding commit hash tag: ${commitHash}`);
        }

        // Create the event
        const event = new NDKEvent(ndk, {
            kind: 1, // Standard short text note
            content,
            tags,
        });

        // Sign the event using the appropriate signer
        await event.sign(signer);

        // Publish the already signed event
        const publishedRelays = await event.publish();
        const agentInfo = effectiveAgentName ? ` using agent '${effectiveAgentName}'` : '';
        log(`INFO: Published event ${event.id} to ${publishedRelays.size} relays${agentInfo}.`);

        if (publishedRelays.size === 0) {
            log("WARN: Event was not published to any relays.");
            // Don't throw error here, just return a warning message maybe? Or let it proceed?
            // For now, let's proceed but log the warning. The return message will indicate 0 relays.
            // throw new Error("Event failed to publish to any relays.");
        }

        // If taskId is provided and publish was successful (or attempted), save the new event ID
        if (taskFilePath && event.id) {
            // Check event.id exists
            try {
                const dir = path.dirname(taskFilePath);
                await fs.mkdir(dir, { recursive: true }); // Ensure directory exists
                await fs.writeFile(taskFilePath, event.id, "utf-8");
                log(`INFO: Saved current event ID ${event.id} to ${taskFilePath}`);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                log(`ERROR: Failed to write task file ${taskFilePath}: ${message}`);
                // Decide how to handle this error - maybe add to the return message?
            }
        }

        const commitInfo = commitHash ? ` (with git commit: ${commitHash})` : "";
        const agentInfoSuffix = effectiveAgentName ? ` as agent '${effectiveAgentName}'` : '';
        return {
            content: [
                {
                    type: "text",
                    text: `Published to Nostr with ID: ${event.encode()} to ${publishedRelays.size} relays${commitInfo}${agentInfoSuffix}.`,
                },
            ],
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`ERROR: Failed to publish: ${errorMessage}`);
        // Rethrow or handle as needed for MCP response
        throw new Error(`Failed to publish: ${errorMessage}`);
    } finally {
        // Optional: Disconnect NDK if managing connections per operation
        // await ndk.disconnect();
    }
}

/**
 * Register the publish command with the MCP server
 * @param server The MCP server instance
 */
export function addPublishCommand(server: McpServer) {
    // Add publish tool - simplified schema
    server.tool(
        "publish",
        "Publish a note to Nostr not related to a task",
        {
            // Only content is needed
            content: z.string().describe("The content of the note you want to publish"),
        },
        // Handler uses only content
        async (
            { content, taskId }: { content: string; taskId?: string },
            _extra: unknown, // Use unknown since it's unused
        ) => {
            return await publishNote(content, taskId);
        },
    );
}

/**
 * Register the publish_task_status_update command with the MCP server
 * @param server The MCP server instance
 */
export function addPublishTaskStatusUpdateCommand(server: McpServer) {
    // Add publish_task_status_update tool
    server.tool(
        "publish_task_status_update",
        "Publish a task status update to Nostr",
        {
            update: z.string().describe("The update to publish (do not include the task ID here)"),
            taskId: z.string().describe("Task ID being worked on"),
            confidence_level: z
                .number()
                .min(1)
                .max(10)
                .describe(
                    "Confidence level of how you, the LLM working, feel about the work being done. (1-10) where 10 is very confident and 1 is very confused",
                ),
            title: z.string().describe("Short title for the status update (used as git commit message)"),
            agent_name: z.string().describe("The name of the agent/mode publishing the update (e.g. 'code', 'planner', 'debugger')"),
        },
        async (
            {
                update,
                taskId,
                confidence_level,
                title,
                agent_name,
            }: { update: string; taskId: string; confidence_level: number; title: string; agent_name: string },
            _extra: unknown,
        ) => {
            return await publishTaskStatusUpdate(update, taskId, confidence_level, title, agent_name);
        },
    );
}
