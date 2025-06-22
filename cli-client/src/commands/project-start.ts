import { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "../logger.js";

// TENEX-specific event kinds
const EVENT_KINDS = {
  TYPING_INDICATOR: 24111 as const,
} as const;
import chalk from "chalk";
import { getNDK } from "../ndk-setup.js";

interface StartProjectOptions {
    nsec: string;
    project: string; // NADDR or project identifier
}

export async function startProject(options: StartProjectOptions): Promise<void> {
    try {
        logger.info(chalk.blue("🚀 Sending project start event..."));

        // Connect to Nostr
        const ndk = await getNDK({ nsec: options.nsec });
        const user = ndk.activeUser;

        if (!user) {
            throw new Error("Failed to authenticate with provided nsec");
        }

        const projectEvent = await ndk.fetchEvent(options.project);
        if (!projectEvent) {
            throw new Error("Project not found");
        }

        // Create a simple chat event that references the project
        // This will trigger the daemon to start the project
        const event = new NDKEvent(ndk);
        event.kind = 24111;
        event.content = "Starting project...";
        event.tag(projectEvent);

        // Publish the event
        await event.publish();

        logger.info(chalk.green("✅ Project start event sent successfully!"));

        process.exit(0);
    } catch (error) {
        logger.error(chalk.red("❌ Failed to send project start event:"), error);
        process.exit(1);
    }
}
