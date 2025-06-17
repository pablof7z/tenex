import type { Agent, ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logInfo } from "@tenex/shared/logger";
import type { UnifiedLLMConfig } from "@tenex/types/config";
import chalk from "chalk";

export class ProjectDisplay {
    async displayProjectInfo(projectInfo: ProjectRuntimeInfo): Promise<void> {
        this.displayBasicInfo(projectInfo);
        await this.displayAgentConfigurations(
            projectInfo.projectEvent,
            projectInfo.projectPath,
            projectInfo.agents
        );
        this.displayLLMSettings(projectInfo.llmConfig);
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
        _projectPath: string,
        agents: Map<string, Agent>
    ): Promise<void> {
        const agentTags = projectEvent.tags.filter((tag) => tag[0] === "agent");
        if (agentTags.length === 0) return;

        logInfo(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        logInfo(chalk.cyan("🤖 Agent Configurations"));
        logInfo(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

        for (const tag of agentTags) {
            const eventId = tag[1];
            if (eventId) {
                this.displayAgent(eventId, agents);
            }
        }
    }

    private displayAgent(eventId: string, agents: Map<string, Agent>): void {
        // Find agent by eventId
        const agentEntry = Array.from(agents.entries()).find(
            ([, agent]) => agent.eventId === eventId
        );

        if (!agentEntry) {
            logInfo(chalk.red(`No agent instance found for event: ${eventId}`));
            return;
        }

        const [_agentKey, agent] = agentEntry;

        // Display agent information with instance pubkey
        logInfo(chalk.gray("\nAgent:       ") + chalk.yellow(agent.name));
        logInfo(chalk.gray("Description: ") + chalk.white(agent.description));
        if (agent.role) {
            logInfo(chalk.gray("Role:        ") + chalk.white(agent.role));
        }
        logInfo(chalk.gray("Pubkey:      ") + chalk.white(agent.pubkey));
        logInfo(chalk.gray("Cached:      ") + chalk.green(`✓ ${eventId}.json`));
    }

    private displayLLMSettings(llmConfig: UnifiedLLMConfig): void {
        const configurations = llmConfig?.configurations || {};
        const defaults = llmConfig?.defaults || {};
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
