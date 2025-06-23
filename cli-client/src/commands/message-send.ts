import { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "../logger.js";
import chalk from "chalk";
import { getNDK } from "../ndk-setup.js";
import { outputResult, outputError } from "../utils/output.js";
import { v4 as uuidv4 } from "uuid";
import { nip19 } from "nostr-tools";

interface SendMessageOptions {
    nsec: string;
    project: string;
    message: string;
    json?: boolean;
}

export async function sendMessage(options: SendMessageOptions): Promise<void> {
    try {
        if (!options.json) {
            logger.info(chalk.blue("📤 Sending message..."));
        }

        // Connect to Nostr
        const ndk = await getNDK({ nsec: options.nsec });
        const user = ndk.activeUser;

        if (!user) {
            throw new Error("Failed to authenticate with provided nsec");
        }

        // Create message event
        const event = new NDKEvent(ndk);
        event.kind = 1; // Text note
        event.content = options.message;

        // Generate thread ID
        const threadId = uuidv4();

        // Parse the project naddr to get the a tag format
        let aTag: string;
        if (options.project.startsWith("naddr")) {
            try {
                const decoded = nip19.decode(options.project);
                if (decoded.type === "naddr" && decoded.data) {
                    const { identifier, pubkey, kind } = decoded.data;
                    aTag = `${kind}:${pubkey}:${identifier}`;
                } else {
                    throw new Error("Invalid naddr");
                }
            } catch (error) {
                throw new Error(`Failed to decode project naddr: ${error}`);
            }
        } else {
            // Assume it's already in a tag format
            aTag = options.project;
        }
        
        // Add tags
        event.tags = [
            ["a", aTag], // Reference to project in kind:pubkey:identifier format
            ["subject", "Thread"],
            ["thread-id", threadId]
        ];

        // Publish the event
        await event.publish();

        // Get event ID
        const eventId = event.id;

        // Output result
        const result = {
            threadId,
            eventId,
            encode: event.encode(), // Add the encoded event
            project: options.project,
            message: options.message,
            author: user.npub,
            timestamp: event.created_at
        };

        outputResult(result, { json: options.json }, (data) => {
            logger.info(chalk.green("✅ Message sent successfully!"));
            logger.info(chalk.gray(`Thread ID: ${data.threadId}`));
            logger.info(chalk.gray(`Event ID: ${data.eventId}`));
            logger.info(chalk.gray(`Encode: ${data.encode}`));
            logger.info(chalk.gray(`Project: ${data.project}`));
        });

        process.exit(0);
    } catch (error) {
        outputError(error as Error, { json: options.json });
        process.exit(1);
    }
}