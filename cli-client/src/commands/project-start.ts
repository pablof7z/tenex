import { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";
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
        
        let projectReference: string;
        let projectTitle = "Project";
        
        // Parse project reference
        if (options.project.startsWith("naddr1")) {
            // It's an NADDR, we need to decode it to get the project reference
            try {
                const projectEvent = await ndk.fetchEvent(options.project);
                if (!projectEvent) {
                    throw new Error("Project not found");
                }
                
                const dTag = projectEvent.tags.find(tag => tag[0] === "d")?.[1];
                if (!dTag) {
                    throw new Error("Project missing d tag");
                }
                
                projectReference = `31933:${projectEvent.pubkey}:${dTag}`;
                projectTitle = projectEvent.tags.find(tag => tag[0] === "title")?.[1] || "Project";
                
                logger.info(chalk.gray(`Found project: ${projectTitle}`));
            } catch (error) {
                throw new Error(`Failed to fetch project: ${error}`);
            }
        } else {
            // Assume it's a direct project reference
            projectReference = options.project;
        }
        
        // Create a simple chat event that references the project
        // This will trigger the daemon to start the project
        const event = new NDKEvent(ndk);
        event.kind = 11; // Chat event
        event.content = "Starting project...";
        event.tags = [
            ["a", projectReference],
            ["title", "Project Start"]
        ];
        
        // Publish the event
        await event.publish();
        
        logger.info(chalk.green("✅ Project start event sent successfully!"));
        logger.info(chalk.gray(`Event ID: ${event.id}`));
        logger.info(chalk.gray(`Project: ${projectReference}`));
        logger.info(chalk.gray(`Author: ${user.npub}`));
        
        process.exit(0);
    } catch (error) {
        logger.error(chalk.red("❌ Failed to send project start event:"), error);
        process.exit(1);
    }
}