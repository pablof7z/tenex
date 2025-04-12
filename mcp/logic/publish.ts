import { NDKEvent } from "@nostr-dev-kit/ndk";
import { z } from "zod";
import { ndk } from "../ndk.js"; // ndk instance should have the signer configured
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { log } from "../lib/utils/log.js"; // Use the correct log import

/**
 * Publish a note to Nostr using the globally configured signer.
 * @param content The content of the note to publish
 * @returns Publication results
 */
export async function publishNote(content: string): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    log(`INFO: Publishing note: "${content.substring(0, 50)}..."`);

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

        // Create the event
        const event = new NDKEvent(ndk, {
            kind: 1,
            content,
            tags: [],
        });

        // Sign the event using the default signer (from TENEX_PRIVATE_KEY)
        await event.sign(); // No argument needed, uses ndk.signer

        // Publish the already signed event
        const publishedRelays = await event.publish();
        log(`INFO: Published event ${event.id} to ${publishedRelays.size} relays.`);

        if (publishedRelays.size === 0) {
            log("WARN: Event was not published to any relays.");
            throw new Error("Event failed to publish to any relays.");
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
        async ({ content }, _extra) => {
            return await publishNote(content);
        },
    );
}
