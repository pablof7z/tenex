/**
 * TENEX CLI: agent publish command
 * Publishes a new agent definition to Nostr.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import NDK, { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { Base64 } from "js-base64";
import { ConfigManager } from "../../config/manager";
import { NDKClient } from "../../nostr/ndkClient";
import { logError, logInfo } from "../../utils/logger";

function getRandomAvatar(seed: string) {
	return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(seed)}`;
}

function parseGooseUri(
	uri: string,
): { title?: string; instructions?: string } | null {
	try {
		// Handle goose:// protocol specially since URL constructor may not handle it properly
		if (!uri.startsWith("goose://recipe?")) {
			logError("URI must start with 'goose://recipe?'");
			return null;
		}

		// Extract the query string part
		const queryString = uri.substring("goose://recipe?".length);
		const params = new URLSearchParams(queryString);

		const configParam = params.get("config");
		if (!configParam) {
			logError("No config parameter found in URI");
			return null;
		}

		// Use js-base64 for robust base64 decoding
		const decodedConfig = Base64.decode(configParam);

		// Extract valid JSON by finding the first complete object
		let jsonStr = decodedConfig.trim();
		let braceCount = 0;
		let jsonEnd = -1;

		for (let i = 0; i < jsonStr.length; i++) {
			const char = jsonStr[i];
			if (char === "{") {
				braceCount++;
			} else if (char === "}") {
				braceCount--;
				if (braceCount === 0) {
					jsonEnd = i + 1;
					break;
				}
			}
		}

		if (jsonEnd > 0 && jsonEnd < jsonStr.length) {
			jsonStr = jsonStr.substring(0, jsonEnd);
		}

		const config = JSON.parse(jsonStr);

		return {
			title: config.title,
			instructions: config.instructions,
		};
	} catch (error) {
		logError(`Failed to parse goose URI: ${error}`);
		return null;
	}
}

function promptForDescription(): Promise<string> {
	return new Promise((resolve) => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		rl.question("Enter a short description for this agent: ", (description) => {
			rl.close();
			resolve(description.trim());
		});
	});
}

function collectFiles(fileArgs: string[]): { [filename: string]: string } {
	const result: { [filename: string]: string } = {};
	for (const arg of fileArgs) {
		const stat = fs.statSync(arg);
		if (stat.isDirectory()) {
			const files = fs.readdirSync(arg);
			for (const file of files) {
				const fullPath = path.join(arg, file);
				if (fs.statSync(fullPath).isFile()) {
					result[file] = fs.readFileSync(fullPath, "utf8");
				}
			}
		} else if (stat.isFile()) {
			result[path.basename(arg)] = fs.readFileSync(arg, "utf8");
		}
	}
	return result;
}

export async function runAgentPublish(cmd: any) {
	const config = ConfigManager.loadConfig();
	if (!config?.user?.nsec) {
		logError("TENEX is not initialized. Run `tenex config` first.");
		process.exit(1);
	}
	const nsec = config.user.nsec;

	// Create NDK instance with signer
	const tempNdk = new NDK({
		signer: new NDKPrivateKeySigner(nsec),
	});
	await tempNdk.connect();
	const pubkey = tempNdk.signer?.pubkey;

	// Handle goose URI if provided
	let gooseConfig: { title?: string; instructions?: string } | null = null;
	if (cmd.goose) {
		gooseConfig = parseGooseUri(cmd.goose);
		if (!gooseConfig) {
			logError("Invalid goose URI format");
			process.exit(1);
		}
	}

	// Gather parameters, prioritizing goose config when available
	const title = cmd.title || gooseConfig?.title || "Untitled Agent";
	const instructions = cmd.instructions || gooseConfig?.instructions || "";

	// Prompt for description if using goose and no description provided
	let description = cmd.description || "";
	if (gooseConfig && !description) {
		description = await promptForDescription();
	}

	const avatar = cmd.avatar || getRandomAvatar(title);
	const role = cmd.role || "";
	const models = cmd.models
		? cmd.models.split(",").map((m: string) => m.trim())
		: [];
	const files = cmd.file ? collectFiles(cmd.file) : {};

	// Compose agent definition
	const agentDef = {
		title,
		avatar,
		description,
		role,
		instructions,
		models,
		files,
	};

	// Publish status update to Nostr: starting publish
	await NDKClient.publishStatusUpdate(nsec, "Starting agent publish...", {
		command: "agent publish",
		title,
		avatar,
		description,
		role,
		instructions,
		models: models.join(","),
		fileCount: Object.keys(files).length,
	});

	// Publish agent definition as a Nostr event (kind 4199, custom for agents)
	const event = new NDKEvent(tempNdk);
	event.kind = 4199;
	event.content = JSON.stringify(agentDef);

	try {
		event.publish();
		logInfo("Agent published to Nostr.");
		// Publish status update to Nostr: success
		await NDKClient.publishStatusUpdate(nsec, "Agent published to Nostr.", {
			command: "agent publish",
			title,
		});

		// Ensure process exits cleanly
		process.exit(0);
	} catch (err) {
		logError(`Failed to publish agent: ${err}`);
		// Publish status update to Nostr: failure
		await NDKClient.publishStatusUpdate(nsec, "Failed to publish agent.", {
			command: "agent publish",
			title,
			error: String(err),
		});
		process.exit(1);
	}
}
