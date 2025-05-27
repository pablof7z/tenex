import { NDKEvent, type NDKTag } from "@nostr-dev-kit/ndk";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { ndk } from "../ndk.js"; // ndk instance should have the signer configured
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"; // Reverting to original path with .js
import { log } from "../lib/utils/log.js"; // Use the correct log import

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
 * @returns Publication results
 */
export async function publishTaskStatusUpdate(
    content: string,
    taskId: string,
    confidenceLevel: number,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    return await publishToNostr(content, taskId, confidenceLevel);
}

/**
 * Common function to publish notes to Nostr with optional confidence level.
 * @param content The content of the note to publish
 * @param taskId The task ID to tag (optional)
 * @param confidenceLevel Confidence level (optional)
 * @returns Publication results
 */
async function publishToNostr(
    content: string,
    taskId?: string,
    confidenceLevel?: number,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    log(`INFO: Publishing note with content type: ${typeof content}, value: "${content ? content.substring(0, 50) : 'undefined'}..."`);

    const taskFilePath = taskId ? path.join(os.homedir(), ".tenex", "tasks", taskId) : undefined;
    let previousEventId: string | undefined = undefined;

    try {
        // Ensure NDK is ready and connected
        if (!ndk) {
            throw new Error("NDK instance is not initialized.");
        }
        await ndk.connect(); // Ensure connection before publishing

        // Check if a signer is configured (should be set up by initNDK from NSEC env var)
        if (!ndk.signer) {
            throw new Error("NDK signer is not configured. Check NSEC environment variable.");
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

        // Create the event
        const event = new NDKEvent(ndk, {
            kind: 1, // Standard short text note
            content,
            tags,
        });

        // Sign the event using the default signer (from TENEX_PRIVATE_KEY)
        await event.sign(); // No argument needed, uses ndk.signer

        // Publish the already signed event
        const publishedRelays = await event.publish();
        log(`INFO: Published event ${event.id} to ${publishedRelays.size} relays.`);

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

        return {
            content: [
                {
                    type: "text",
                    text: `Published to Nostr with ID: ${event.encode()} to ${publishedRelays.size} relays.`,
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
            update: z.string().describe("The updat to publish (do not include the task ID here)"),
            taskId: z.string().describe("Task ID being worked on"),
            confidence_level: z.number()
                .min(1)
                .max(10)
                .describe("Confidence level of how you, the LLM working, feel about the work being done. (1-10) where 10 is very confident and 1 is very confused"),
        },
        async (
            { update, taskId, confidence_level }: { update: string; taskId: string; confidence_level: number },
            _extra: unknown,
        ) => {
            return await publishTaskStatusUpdate(update, taskId, confidence_level);
        },
    );
}
