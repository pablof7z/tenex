/**
 * TENEX CLI: agent publish command
 * Publishes a new agent definition to Nostr.
 */

import NDK, { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import fs from "fs";
import path from "path";
import { NDKClient } from "../../nostr/ndkClient";
import { ConfigManager } from "../../config/manager";
import { logError, logInfo } from "../../utils/logger";

function getRandomAvatar(seed: string) {
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(seed)}`;
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
        return;
    }
    const nsec = config.user.nsec;
    
    // Create NDK instance with signer
    const tempNdk = new NDK({
        signer: new NDKPrivateKeySigner(nsec),
    });
    await tempNdk.connect();
    const pubkey = tempNdk.signer?.pubkey;

    // Gather parameters
    const title = cmd.title || "Untitled Agent";
    const avatar = cmd.avatar || getRandomAvatar(title);
    const description = cmd.description || "";
    const role = cmd.role || "";
    const instructions = cmd.instructions || "";
    const models = cmd.models ? cmd.models.split(",").map((m: string) => m.trim()) : [];
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

    // Publish agent definition as a Nostr event (kind 31990, custom for agents)
    const event = new NDKEvent(tempNdk);
    event.kind = 31990;
    event.content = JSON.stringify(agentDef);

    try {
        event.publish();
        logInfo("Agent published to Nostr.");
        // Publish status update to Nostr: success
        await NDKClient.publishStatusUpdate(nsec, "Agent published to Nostr.", {
            command: "agent publish",
            title,
        });
    } catch (err) {
        logError("Failed to publish agent: " + err);
        // Publish status update to Nostr: failure
        await NDKClient.publishStatusUpdate(nsec, "Failed to publish agent.", {
            command: "agent publish",
            title,
            error: String(err),
        });
    }
}
