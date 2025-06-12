import { spawn } from "child_process";
import path from "path";
import type { NDK, NDKEvent } from "@nostr-dev-kit/ndk";
import chalk from "chalk";
import { nip19 } from "nostr-tools";
import {
	logError,
	logInfo,
	logSuccess,
	logWarning,
} from "../../../shared/src/logger.js";
import {
	checkProjectExists,
	extractProjectIdentifierFromTag,
} from "../../../shared/src/projects.js";
import type { Config } from "../config/config.js";

export async function handleChatEvent(
	event: NDKEvent,
	config: Config,
	ndk: NDK,
	configManager?: any,
): Promise<void> {
	if (!config.chatCommand) {
		logWarning("Chat command not configured, ignoring chat event");
		return;
	}

	if (!config.projectsPath) {
		logError("Configuration error: projectsPath is not set");
		return;
	}

	// For kind:1111 replies, we need to fetch the root event
	let eventToProcess = event;
	if (event.kind === 1111) {
		const rootEventTag = event.tags.find((tag) => tag[0] === "E");
		if (!rootEventTag || !rootEventTag[1]) {
			logWarning("Kind:1111 event missing root 'E' tag");
			return;
		}

		logInfo(`Fetching root event ${rootEventTag[1]} for kind:1111 reply`);
		const rootEvent = await ndk.fetchEvent(rootEventTag[1]);

		if (!rootEvent) {
			logError(`Failed to fetch root event ${rootEventTag[1]}`);
			return;
		}

		if (rootEvent.kind !== 11) {
			logWarning(
				`Root event ${rootEventTag[1]} is not kind:11 (found kind:${rootEvent.kind})`,
			);
			return;
		}

		eventToProcess = rootEvent;
		logSuccess(`Fetched root event for kind:1111 reply`);
	}

	// Find the project a-tag
	const projectTag = eventToProcess.tags.find(
		(tag) => tag[0] === "a" && tag[1]?.startsWith("31933:"),
	);

	if (!projectTag) {
		logWarning("Chat event missing project 'a' tag for kind:31933");
		return;
	}

	const projectATag = projectTag[1];

	try {
		const projectIdentifier = extractProjectIdentifierFromTag(projectATag);
		logInfo(`Processing chat event for project ${projectIdentifier}`);

		const projectInfo = await checkProjectExists(
			config.projectsPath,
			projectIdentifier,
		);

		if (!projectInfo.exists) {
			logWarning(
				`Project ${projectInfo.name} not found locally at ${projectInfo.path}`,
			);
			logWarning("Ignoring chat event for non-existent project");
			return;
		}

		logSuccess(`Project ${projectInfo.name} found at ${projectInfo.path}`);

		// Generate nevent for the event to process (either the original kind:11 or the root event)
		const nevent = eventToProcess.encode();

		// Execute the chat command
		await executeChatCommand(config, projectInfo.path, nevent);
	} catch (err: any) {
		logError(`Failed to handle chat event: ${err.message}`);
	}
}

async function executeChatCommand(
	config: Config,
	projectPath: string,
	nevent: string,
): Promise<void> {
	const command = config.chatCommand!;

	logInfo(`Executing chat command: ${command} ${nevent}`);
	logInfo(`Working directory: ${projectPath}`);

	return new Promise((resolve, reject) => {
		const fullCommand = `${command} ${nevent}`;

		const child = spawn(fullCommand, [], {
			cwd: projectPath,
			stdio: "inherit",
			shell: true,
		});

		child.on("error", (error) => {
			logError(`Failed to execute chat command: ${error.message}`);
			reject(error);
		});

		child.on("exit", (code) => {
			if (code === 0) {
				logSuccess("Chat command completed successfully");
				resolve();
			} else {
				logError(`Chat command exited with code ${code}`);
				reject(new Error(`Chat command exited with code ${code}`));
			}
		});
	});
}
