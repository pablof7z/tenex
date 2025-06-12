import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NDKEvent, type NDKTag } from "@nostr-dev-kit/ndk";
import { z } from "zod";
import { createCommit, hasUncommittedChanges } from "../lib/git.js";
import { log } from "../lib/utils/log.js";
import { ndk } from "../ndk.js";


/**
 * Publish a task status update to Nostr with confidence level.
 * @param content The content of the note to publish
 * @param taskId The task ID to tag
 * @param confidenceLevel Confidence level (1-10) where 10 is very confident and 1 is very confused
 * @param title Short title for the status update (used as git commit message)
 * @returns Publication results
 */
export async function publishTaskStatusUpdate(
	content: string,
	taskId: string,
	confidenceLevel: number,
	title: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
	let commitHash: string | undefined = undefined;

	// Handle git operations
	try {
		// Check for uncommitted changes
		const hasChanges = await hasUncommittedChanges();
		if (hasChanges) {
			log(
				`INFO: Found uncommitted changes, creating commit with title: "${title}"`,
			);
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
		log(
			`WARN: Git operation failed: ${errorMessage}. Continuing with nostr publishing.`,
		);
		// Continue with nostr publishing even if git operations fail
	}

	return await publishToNostr(
		content,
		taskId,
		confidenceLevel,
		commitHash,
	);
}

/**
 * Common function to publish notes to Nostr with optional confidence level.
 * @param content The content of the note to publish
 * @param taskId The task ID to tag (optional)
 * @param confidenceLevel Confidence level (optional)
 * @param commitHash Git commit hash (optional)
 * @returns Publication results
 */
async function publishToNostr(
	content: string,
	taskId?: string,
	confidenceLevel?: number,
	commitHash?: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
	log(
		`INFO: Publishing note with content type: ${typeof content}, value: "${content ? content.substring(0, 50) : "undefined"}..."`,
	);

	const taskFilePath = taskId
		? path.join(os.homedir(), ".tenex", "tasks", taskId)
		: undefined;
	let previousEventId: string | undefined = undefined;

	try {
		// Ensure NDK is ready and connected
		if (!ndk) {
			throw new Error("NDK instance is not initialized.");
		}
		await ndk.connect(); // Ensure connection before publishing

		// Ensure signer is available
		if (!ndk.signer) {
			throw new Error("No signer available for publishing. Ensure NSEC is provided.");
		}

		// If taskId is provided, try to read the previous event ID
		if (taskFilePath) {
			try {
				previousEventId = await fs.readFile(taskFilePath, "utf-8");
				log(
					`INFO: Found previous event ID ${previousEventId} for task ${taskId}`,
				);
			} catch (error: unknown) {
				// Check if it's a Node.js file system error
				if (
					typeof error === "object" &&
					error !== null &&
					"code" in error &&
					error.code === "ENOENT"
				) {
					log(`INFO: No previous event file found for task ${taskId}.`);
				} else if (error instanceof Error) {
					log(
						`WARN: Error reading task file ${taskFilePath}: ${error.message}`,
					);
				} else {
					log(
						`WARN: Unknown error reading task file ${taskFilePath}: ${String(error)}`,
					);
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

		// Sign the event
		await event.sign();

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

		const commitInfo = commitHash ? ` (with git commit: ${commitHash})` : "";
		return {
			content: [
				{
					type: "text",
					text: `Published to Nostr with ID: ${event.encode()} to ${publishedRelays.size} relays${commitInfo}.`,
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
 * Publish a typing indicator to Nostr.
 * @param threadId The thread/conversation ID to e-tag
 * @param isTyping Whether the agent is typing (true) or stopped typing (false)
 * @returns Publication results
 */
export async function publishTypingIndicator(
	threadId: string,
	isTyping: boolean,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
	try {
		// Ensure NDK is ready and connected
		if (!ndk) {
			throw new Error("NDK instance is not initialized.");
		}
		await ndk.connect();

		// Ensure signer is available
		if (!ndk.signer) {
			throw new Error("No signer available for publishing typing indicator. Ensure NSEC is provided.");
		}

		// Prepare tags
		const tags: NDKTag[] = [["e", threadId]];

		// Create the event
		const event = new NDKEvent(ndk, {
			kind: isTyping ? 24111 : 24112,
			content: isTyping ? "Typing..." : "",
			tags,
		});

		// Sign and publish
		await event.sign();
		const publishedRelays = await event.publish();

		log(
			`INFO: Published ${isTyping ? "typing" : "stop typing"} indicator to ${publishedRelays.size} relays.`,
		);

		return {
			content: [
				{
					type: "text",
					text: `Published ${isTyping ? "typing" : "stop typing"} indicator to ${publishedRelays.size} relays.`,
				},
			],
		};
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		log(`ERROR: Failed to publish typing indicator: ${errorMessage}`);
		throw new Error(`Failed to publish typing indicator: ${errorMessage}`);
	}
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
			update: z
				.string()
				.describe("The update to publish (do not include the task ID here)"),
			taskId: z.string().describe("Task ID being worked on"),
			confidence_level: z
				.number()
				.min(1)
				.max(10)
				.describe(
					"Confidence level of how you, the LLM working, feel about the work being done. (1-10) where 10 is very confident and 1 is very confused",
				),
			title: z
				.string()
				.describe(
					"Short title for the status update (used as git commit message)",
				),
		},
		async (
			{
				update,
				taskId,
				confidence_level,
				title,
			}: {
				update: string;
				taskId: string;
				confidence_level: number;
				title: string;
			},
			_extra: unknown,
		) => {
			return await publishTaskStatusUpdate(
				update,
				taskId,
				confidence_level,
				title,
			);
		},
	);
}

/**
 * Register the publish_typing_indicator command with the MCP server
 * @param server The MCP server instance
 */
export function addPublishTypingIndicatorCommand(server: McpServer) {
	server.tool(
		"publish_typing_indicator",
		"Publish a typing indicator to Nostr",
		{
			threadId: z.string().describe("The thread/conversation ID to e-tag"),
			isTyping: z
				.boolean()
				.describe("Whether the agent is typing (true) or stopped typing (false)"),
		},
		async (
			{
				threadId,
				isTyping,
			}: {
				threadId: string;
				isTyping: boolean;
			},
			_extra: unknown,
		) => {
			return await publishTypingIndicator(threadId, isTyping);
		},
	);
}
