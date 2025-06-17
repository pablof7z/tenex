import path from "node:path";
import type { ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";
import * as fileSystem from "@tenex/shared/fs";
import { logError, logInfo, logWarning } from "@tenex/shared/logger";
import type { UnifiedLLMConfig } from "@tenex/types/config";
import { EVENT_KINDS } from "@tenex/types/events";
import type { LLMConfigs } from "@tenex/types/llm";
import chalk from "chalk";

export class ProjectDisplay {
    constructor(private ndk: NDK) {}

    async displayProjectInfo(projectInfo: ProjectRuntimeInfo): Promise<void> {
        this.displayBasicInfo(projectInfo);
        await this.displayAgentConfigurations(projectInfo.projectEvent, projectInfo.projectPath);
        await this.displayLLMSettings(projectInfo.projectPath);
        // Note: Documentation display moved to after subscription EOSE
        logInfo(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
    }

    private displayBasicInfo(projectInfo: ProjectRuntimeInfo): void {
        logInfo(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        logInfo(chalk.cyan("📦 Project Information"));
        logInfo(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        logInfo(chalk.gray("Title:      ") + chalk.white(projectInfo.title));
        logInfo(chalk.gray("Repository: ") + chalk.white(projectInfo.repository));
        logInfo(chalk.gray("Path:       ") + chalk.white(projectInfo.projectPath));
        if (projectInfo.projectEvent.id) {
            logInfo(
                chalk.gray("Event ID:   ") +
                    chalk.gray(`${projectInfo.projectEvent.id.substring(0, 16)}...`)
            );
        }
    }

    private async displayAgentConfigurations(
        projectEvent: NDKEvent,
        projectPath: string
    ): Promise<void> {
        const agentTags = projectEvent.tags.filter((tag) => tag[0] === "agent");
        if (agentTags.length === 0) return;

        logInfo(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        logInfo(chalk.cyan("🤖 Agent Configurations"));
        logInfo(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

        const agentsDir = path.join(projectPath, ".tenex", "agents");
        await fileSystem.ensureDirectory(agentsDir);

        for (const tag of agentTags) {
            if (tag[1]) {
                await this.displayAndCacheAgent(tag[1], agentsDir);
            }
        }
    }

    private async displayAndCacheAgent(eventId: string, agentsDir: string): Promise<void> {
        try {
            const agentEvent = await this.ndk.fetchEvent(eventId);

            if (!agentEvent || agentEvent.kind !== EVENT_KINDS.AGENT_CONFIG) {
                logInfo(chalk.red(`Failed to fetch agent event: ${eventId}`));
                return;
            }

            const agentName = agentEvent.tags.find((t) => t[0] === "title")?.[1] || "unnamed";
            const description = agentEvent.tags.find((t) => t[0] === "description")?.[1] || "";
            const role = agentEvent.tags.find((t) => t[0] === "role")?.[1] || "";

            logInfo(chalk.gray("\nAgent:       ") + chalk.yellow(agentName));
            logInfo(chalk.gray("Description: ") + chalk.white(description));
            if (role) {
                logInfo(chalk.gray("Role:        ") + chalk.white(role));
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
            await fileSystem.writeJsonFile(agentFile, agentDefinition);
            logInfo(chalk.gray("Cached:      ") + chalk.green(`✓ ${eventId}.json`));
        } catch (_err) {
            logInfo(chalk.red(`Failed to fetch agent configuration: ${eventId}`));
        }
    }

    private async displayLLMSettings(projectPath: string): Promise<void> {
        const llmsPath = path.join(projectPath, ".tenex", "llms.json");

        try {
            const llmsFile = await fileSystem.readJsonFile<UnifiedLLMConfig>(llmsPath);

            // Handle the new structured format with configurations, defaults, and credentials
            const configurations = llmsFile?.configurations || {};
            const defaults = llmsFile?.defaults || {};
            const defaultConfig = defaults.default;

            const configNames = Object.keys(configurations);

            if (configNames.length === 0) {
                // Don't show the header if there are no configs
                return;
            }

            logInfo(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
            logInfo(chalk.cyan("🤖 Available LLM Configurations"));
            logInfo(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

            for (const name of configNames) {
                const config = configurations[name];
                if (typeof config !== "object" || !config) continue;

                const isDefault = name === defaultConfig;
                logInfo(
                    chalk.gray("\nName:       ") +
                        chalk.yellow(name) +
                        (isDefault ? chalk.green(" (default)") : "")
                );
                logInfo(chalk.gray("Provider:   ") + chalk.white(config.provider));
                logInfo(chalk.gray("Model:      ") + chalk.white(config.model));
                if (config.baseURL) {
                    logInfo(chalk.gray("Base URL:   ") + chalk.white(config.baseURL));
                }
            }
        } catch (_err) {
            // Silent failure - just don't display anything if llms.json doesn't exist
        }
    }

    private async displaySpecificationDocuments(projectInfo: ProjectRuntimeInfo): Promise<void> {
        const specs = projectInfo.specCache.getAllSpecMetadata();

        if (specs.length === 0) {
            return;
        }

        logInfo(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        logInfo(chalk.cyan("📋 Living Documentation (NDKArticle Events)"));
        logInfo(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

        for (const spec of specs) {
            const lastUpdated = new Date(spec.lastUpdated * 1000).toLocaleDateString();
            logInfo(chalk.gray("\nDocument:    ") + chalk.yellow(spec.id));
            logInfo(chalk.gray("Title:       ") + chalk.white(spec.title));
            logInfo(chalk.gray("Last Updated:") + chalk.white(lastUpdated));
            if (spec.summary) {
                logInfo(chalk.gray("Summary:     ") + chalk.white(spec.summary));
            }
            if (spec.contentSize) {
                logInfo(chalk.gray("Size:        ") + chalk.gray(`${spec.contentSize} characters`));
            }
        }
    }

    async displayAllDocumentation(projectInfo: ProjectRuntimeInfo): Promise<void> {
        await this.displaySpecificationDocuments(projectInfo);
    }
}
