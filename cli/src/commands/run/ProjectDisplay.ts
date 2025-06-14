import path from "node:path";
import type { NDK, NDKEvent } from "@nostr-dev-kit/ndk";
import { fileSystem } from "@tenex/shared/node";
import { EVENT_KINDS } from "@tenex/types/events";
import chalk from "chalk";
import type { ProjectInfo } from "./ProjectLoader";

export class ProjectDisplay {
    constructor(private ndk: NDK) {}

    async displayProjectInfo(projectInfo: ProjectInfo): Promise<void> {
        this.displayBasicInfo(projectInfo);
        await this.displayAgentConfigurations(projectInfo.projectEvent, projectInfo.projectPath);
        await this.displayLLMSettings(projectInfo.projectPath);
        // Note: Documentation display moved to after subscription EOSE
        console.log(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
    }

    private displayBasicInfo(projectInfo: ProjectInfo): void {
        console.log(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        console.log(chalk.cyan("📦 Project Information"));
        console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        console.log(chalk.gray("Title:      ") + chalk.white(projectInfo.title));
        console.log(chalk.gray("Repository: ") + chalk.white(projectInfo.repository));
        console.log(chalk.gray("Path:       ") + chalk.white(projectInfo.projectPath));
        console.log(
            chalk.gray("Event ID:   ") +
                chalk.gray(`${projectInfo.projectEvent.id.substring(0, 16)}...`)
        );
    }

    private async displayAgentConfigurations(
        projectEvent: NDKEvent,
        projectPath: string
    ): Promise<void> {
        const agentTags = projectEvent.tags.filter((tag) => tag[0] === "agent");
        if (agentTags.length === 0) return;

        console.log(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        console.log(chalk.cyan("🤖 Agent Configurations"));
        console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

        const agentsDir = path.join(projectPath, ".tenex", "agents");
        await fs.mkdir(agentsDir, { recursive: true });

        for (const tag of agentTags) {
            await this.displayAndCacheAgent(tag[1], agentsDir);
        }
    }

    private async displayAndCacheAgent(eventId: string, agentsDir: string): Promise<void> {
        try {
            const agentEvent = await this.ndk.fetchEvent(eventId);

            if (!agentEvent || agentEvent.kind !== EVENT_KINDS.AGENT_CONFIG) {
                console.log(chalk.red(`Failed to fetch agent event: ${eventId}`));
                return;
            }

            const agentName = agentEvent.tags.find((t) => t[0] === "title")?.[1] || "unnamed";
            const description = agentEvent.tags.find((t) => t[0] === "description")?.[1] || "";
            const role = agentEvent.tags.find((t) => t[0] === "role")?.[1] || "";

            console.log(chalk.gray("\nAgent:       ") + chalk.yellow(agentName));
            console.log(chalk.gray("Description: ") + chalk.white(description));
            if (role) {
                console.log(chalk.gray("Role:        ") + chalk.white(role));
            }

            const agentDefinition = {
                eventId: eventId,
                name: agentName,
                description: description,
                role: role,
                instructions: agentEvent.content || "",
                version: agentEvent.tags.find((t) => t[0] === "ver")?.[1] || "1",
                systemPrompt: agentEvent.content || "",
            };

            const agentFile = path.join(agentsDir, `${eventId}.json`);
            await fs.writeFile(agentFile, JSON.stringify(agentDefinition, null, 2));
            console.log(chalk.gray("Cached:      ") + chalk.green(`✓ ${eventId}.json`));
        } catch (_err) {
            console.log(chalk.red(`Failed to fetch agent configuration: ${eventId}`));
        }
    }

    private async displayLLMSettings(projectPath: string): Promise<void> {
        const llmsPath = path.join(projectPath, ".tenex", "llms.json");

        try {
            const llmsContent = await fs.readFile(llmsPath, "utf-8");
            const llms = JSON.parse(llmsContent);

            const defaultConfig = llms.default;
            llms.default = undefined;

            const configNames = Object.keys(llms).filter(
                (name) => name !== undefined && llms[name] && typeof llms[name] === "object"
            );

            if (configNames.length === 0) {
                // Don't show the header if there are no configs
                return;
            }

            console.log(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
            console.log(chalk.cyan("🤖 Available LLM Configurations"));
            console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

            for (const name of configNames) {
                const config = llms[name];
                const isDefault = name === defaultConfig;
                console.log(
                    chalk.gray("\nName:       ") +
                        chalk.yellow(name) +
                        (isDefault ? chalk.green(" (default)") : "")
                );
                console.log(chalk.gray("Provider:   ") + chalk.white(config.provider));
                console.log(chalk.gray("Model:      ") + chalk.white(config.model));
                if (config.baseURL) {
                    console.log(chalk.gray("Base URL:   ") + chalk.white(config.baseURL));
                }
            }
        } catch (_err) {
            // Silent failure - just don't display anything if llms.json doesn't exist
        }
    }

    private async displaySpecificationDocuments(projectInfo: ProjectInfo): Promise<void> {
        const specs = projectInfo.specCache.getAllSpecMetadata();

        if (specs.length === 0) {
            return;
        }

        console.log(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        console.log(chalk.cyan("📋 Living Documentation (NDKArticle Events)"));
        console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

        for (const spec of specs) {
            const lastUpdated = new Date(spec.lastUpdated * 1000).toLocaleDateString();
            console.log(chalk.gray("\nDocument:    ") + chalk.yellow(spec.id));
            console.log(chalk.gray("Title:       ") + chalk.white(spec.title));
            console.log(chalk.gray("Last Updated:") + chalk.white(lastUpdated));
            if (spec.summary) {
                console.log(chalk.gray("Summary:     ") + chalk.white(spec.summary));
            }
            if (spec.contentSize) {
                console.log(
                    chalk.gray("Size:        ") + chalk.gray(`${spec.contentSize} characters`)
                );
            }
        }
    }

    async displayAllDocumentation(projectInfo: ProjectInfo): Promise<void> {
        await this.displaySpecificationDocuments(projectInfo);
    }
}
