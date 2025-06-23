import { NDKEvent, NDKFilter } from "@nostr-dev-kit/ndk";
import { logger } from "../logger.js";
import chalk from "chalk";
import { getNDK } from "../ndk-setup.js";
import { outputResult, outputError } from "../utils/output.js";

interface ListProjectOptions {
    nsec: string;
    json?: boolean;
}

interface ProjectInfo {
    naddr: string;
    name: string;
    description?: string;
    created: number;
    author: string;
}

export async function listProjects(options: ListProjectOptions): Promise<void> {
    try {
        if (!options.json) {
            logger.info(chalk.blue("📋 Fetching TENEX projects..."));
        }

        // Connect to Nostr
        const ndk = await getNDK({ nsec: options.nsec });
        const user = ndk.activeUser;

        if (!user) {
            throw new Error("Failed to authenticate with provided nsec");
        }

        // Create filter for projects
        const filter: NDKFilter = {
            kinds: [31337],
            authors: [user.pubkey]
        };

        // Fetch projects
        const events = await ndk.fetchEvents(filter);
        
        // Convert events to project info
        const projects: ProjectInfo[] = [];
        
        for (const event of events) {
            const titleTag = event.tags.find(tag => tag[0] === "title");
            const dTag = event.tags.find(tag => tag[0] === "d");
            
            if (titleTag && dTag) {
                const naddr = event.encode();
                projects.push({
                    naddr,
                    name: titleTag[1] || "Untitled",
                    description: event.content,
                    created: event.created_at || 0,
                    author: user.npub
                });
            }
        }

        // Sort by creation date (newest first)
        projects.sort((a, b) => b.created - a.created);

        outputResult(projects, { json: options.json }, (data) => {
            if (data.length === 0) {
                logger.info(chalk.yellow("No projects found"));
                return;
            }

            logger.info(chalk.green(`\nFound ${data.length} project(s):\n`));
            
            for (const project of data) {
                const date = new Date(project.created * 1000).toLocaleDateString();
                logger.info(chalk.bold(`📁 ${project.name}`));
                logger.info(chalk.gray(`   NADDR: ${project.naddr}`));
                if (project.description) {
                    logger.info(chalk.gray(`   Description: ${project.description}`));
                }
                logger.info(chalk.gray(`   Created: ${date}`));
                logger.info("");
            }
        });

        process.exit(0);
    } catch (error) {
        outputError(error as Error, { json: options.json });
        process.exit(1);
    }
}