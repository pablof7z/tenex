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
    taskId: string | undefined,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    log(`INFO: Publishing note: "${content.substring(0, 50)}..."`);

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

export function addPublishCommand(server: McpServer) {
    // Add publish tool - simplified schema
    server.tool(
        "publish",
        "Publish a note to Nostr",
        {
            // Only content is needed
            content: z.string().describe("The content of the note you want to publish"),
            taskId: z.string().optional().describe("Task ID for tracking"),
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
