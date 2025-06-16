import { NDKEvent, NDKProject } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";
import chalk from "chalk";
import { getNDK } from "../ndk-setup.js";

interface CreateProjectOptions {
    name: string;
    nsec: string;
    description?: string;
    repo?: string;
    hashtags?: string;
}

export async function createProject(options: CreateProjectOptions): Promise<void> {
    try {
        logger.info(chalk.blue("🚀 Creating TENEX project..."));
        
        // Connect to Nostr
        const ndk = await getNDK({ nsec: options.nsec });
        const user = ndk.activeUser;
        
        if (!user) {
            throw new Error("Failed to authenticate with provided nsec");
        }
        
        // Create project event
        const project = new NDKProject(ndk);
        
        // Generate a unique identifier
        const projectId = `${options.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
        
        // Set basic properties
        project.title = options.name;
        project.content = options.description || `A TENEX project: ${options.name}`;
        project.tags.push(["d", projectId]);
        
        // Add optional properties
        if (options.repo) {
            project.repo = options.repo;
        }
        
        if (options.hashtags) {
            const hashtagArray = options.hashtags
                .split(",")
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0);
            project.hashtags = hashtagArray;
        }
        
        // Don't add agent tags in the test - the daemon will handle creating a default agent
        
        // Publish the project
        await project.publish();
        
        const naddr = project.encode();
        
        logger.info(chalk.green("✅ Project created successfully!"));
        logger.info(chalk.gray(`Project ID: ${projectId}`));
        logger.info(chalk.gray(`NADDR: ${naddr}`));
        logger.info(chalk.gray(`Author: ${user.npub}`));
        
        // Return the naddr for programmatic usage
        console.log(naddr);
        
        process.exit(0);
    } catch (error) {
        logger.error(chalk.red("❌ Failed to create project:"), error);
        process.exit(1);
    }
}