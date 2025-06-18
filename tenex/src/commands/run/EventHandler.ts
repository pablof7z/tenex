import path from "node:path";
import { type EventRouter, createAgentSystem } from "@/agents";
import type { AgentConfig } from "@/agents/core/types";
import { createLLMProvider } from "@/agents/infrastructure/LLMProviderAdapter";
import { NostrPublisher } from "@/agents/infrastructure/NostrPublisher";
import type { ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import { getEventKindName } from "@/commands/run/constants";
import { getNDK } from "@/nostr/ndkClient";
import { createAgent } from "@/utils/agents/createAgent";
import { formatError } from "@/utils/errors";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { ensureDirectory, fileExists, readFile, writeJsonFile } from "@tenex/shared/fs";
import { logInfo } from "@tenex/shared/logger";
import { configurationService } from "@tenex/shared/services";
import { EVENT_KINDS } from "@tenex/types/events";
import type { LLMProvider } from "@tenex/types/llm";
import chalk from "chalk";

export class EventHandler {
    private eventRouter!: EventRouter;
    private agentConfigs: Map<string, AgentConfig>;

    constructor(private projectInfo: ProjectRuntimeInfo) {
        this.agentConfigs = new Map();
    }

    async initialize(): Promise<void> {
        // Load configuration
        const configuration = await configurationService.loadConfiguration(
            this.projectInfo.projectPath
        );

        // Load agent configurations
        await this.loadAgentConfigs();

        // Get LLM configuration
        const defaultLLMName = configuration.llms?.defaults?.agents || "default";
        const llmConfig = configurationService.resolveConfigReference(
            configuration.llms,
            defaultLLMName
        );

        if (!llmConfig) {
            throw new Error("No LLM configuration found");
        }

        // Check for team building-specific LLM config
        const teamBuildingLLMName = configuration.llms?.defaults?.teamBuilding;
        const teamBuildingLLMConfig = teamBuildingLLMName
            ? configurationService.resolveConfigReference(configuration.llms, teamBuildingLLMName)
            : undefined;

        // Create the new agent system
        this.eventRouter = await createAgentSystem({
            projectPath: this.projectInfo.projectPath,
            projectContext: {
                projectId: this.projectInfo.projectEvent.id!,
                title: this.projectInfo.title,
                description: this.projectInfo.projectEvent.content,
                repository: this.projectInfo.repository,
            },
            projectEvent: this.projectInfo.projectEvent,
            projectSigner: this.projectInfo.projectSigner,
            agents: this.agentConfigs,
            llmConfig,
            teamBuildingLLMConfig,
            ndk: getNDK(),
        });
    }

    private async loadAgentConfigs(): Promise<void> {
        const agentsJsonPath = path.join(this.projectInfo.projectPath, ".tenex", "agents.json");
        try {
            const agentsJsonContent = await readFile(agentsJsonPath, "utf-8");
            const agentsJson = JSON.parse(agentsJsonContent);

            for (const [name, config] of Object.entries(agentsJson)) {
                const agentConfig = config as { nsec: string; file?: string };

                // Load agent definition from file if available
                let description = `${name} agent`;
                let role = `${name} specialist`;
                let instructions = `You are the ${name} agent for this project.`;

                if (agentConfig.file) {
                    const agentDefPath = path.join(
                        this.projectInfo.projectPath,
                        ".tenex",
                        "agents",
                        agentConfig.file
                    );
                    if (await fileExists(agentDefPath)) {
                        const agentDefContent = await readFile(agentDefPath, "utf-8");
                        const agentDef = JSON.parse(agentDefContent);
                        description = agentDef.description || description;
                        role = agentDef.role || role;
                        instructions = agentDef.instructions || instructions;
                    }
                }

                this.agentConfigs.set(name, {
                    name,
                    role,
                    instructions,
                    nsec: agentConfig.nsec,
                });
            }
        } catch (error) {
            logInfo(chalk.red(`Failed to load agents.json: ${formatError(error)}`));
            throw error;
        }
    }

    async handleEvent(event: NDKEvent): Promise<void> {
        // Ignore kind 24010 (project status), 24111 (typing indicator), and 24112 (typing stop) events
        if (
            event.kind === EVENT_KINDS.PROJECT_STATUS ||
            event.kind === EVENT_KINDS.TYPING_INDICATOR ||
            event.kind === EVENT_KINDS.TYPING_INDICATOR_STOP
        ) {
            return;
        }

        // Handle LLM config change events separately (only from project owner)
        if (event.kind === EVENT_KINDS.LLM_CONFIG_CHANGE) {
            await this.handleLLMConfigChange(event);
            return;
        }

        logInfo(chalk.gray("\n📥 Event received:", event.id));

        const timestamp = new Date().toLocaleTimeString();
        const eventKindName = getEventKindName(event.kind);

        logInfo(chalk.gray(`\n[${timestamp}] `) + chalk.cyan(`${eventKindName} received`));
        logInfo(chalk.gray("From:    ") + chalk.white(event.author.npub));
        logInfo(chalk.gray("Event:   ") + chalk.gray(event.encode()));

        switch (event.kind) {
            case EVENT_KINDS.TEXT_NOTE:
                this.handleStatusUpdate(event);
                break;

            case EVENT_KINDS.CHAT:
            case EVENT_KINDS.THREAD_REPLY:
                await this.handleChatMessage(event);
                break;

            case EVENT_KINDS.TASK:
                await this.handleTask(event);
                break;

            case EVENT_KINDS.PROJECT_STATUS:
                this.handleProjectStatus(event);
                break;

            case EVENT_KINDS.PROJECT:
                await this.handleProjectEvent(event);
                break;

            default:
                this.handleDefaultEvent(event);
        }
    }

    private handleStatusUpdate(event: NDKEvent): void {
        logInfo(
            chalk.gray("Content: ") +
                chalk.white(
                    event.content.substring(0, 100) + (event.content.length > 100 ? "..." : "")
                )
        );
    }

    private async handleChatMessage(event: NDKEvent): Promise<void> {
        logInfo(
            chalk.gray("Message: ") +
                chalk.white(
                    event.content.substring(0, 100) + (event.content.length > 100 ? "..." : "")
                )
        );

        // Extract p-tags to identify mentioned agents
        const pTags = event.tags.filter((tag) => tag[0] === "p");
        const mentionedPubkeys = pTags.map((tag) => tag[1]);

        if (mentionedPubkeys.length > 0) {
            logInfo(
                chalk.gray("P-tags:  ") + chalk.cyan(`${mentionedPubkeys.length} pubkeys mentioned`)
            );
        }

        // Use the new event router to handle the event
        await this.eventRouter.handleEvent(event);
    }

    private async handleTask(event: NDKEvent): Promise<void> {
        const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled";
        logInfo(chalk.gray("Task:    ") + chalk.yellow(title));
        logInfo(
            chalk.gray("Content: ") +
                chalk.white(
                    event.content.substring(0, 100) + (event.content.length > 100 ? "..." : "")
                )
        );

        // Extract p-tags to identify mentioned agents
        const pTags = event.tags.filter((tag) => tag[0] === "p");
        const mentionedPubkeys = pTags.map((tag) => tag[1]);

        if (mentionedPubkeys.length > 0) {
            logInfo(
                chalk.gray("P-tags:  ") + chalk.cyan(`${mentionedPubkeys.length} pubkeys mentioned`)
            );
        }

        // Use the new event router to handle the event
        await this.eventRouter.handleEvent(event);
    }

    private handleProjectStatus(event: NDKEvent): void {
        const ndk = getNDK();
        if (event.author.pubkey !== ndk.activeUser?.pubkey) {
            logInfo(chalk.gray("Status:  ") + chalk.green("Another instance is online"));
        }
    }

    private handleDefaultEvent(event: NDKEvent): void {
        if (event.content) {
            logInfo(
                chalk.gray("Content: ") +
                    chalk.white(
                        event.content.substring(0, 100) + (event.content.length > 100 ? "..." : "")
                    )
            );
        }
    }

    private async handleProjectEvent(event: NDKEvent): Promise<void> {
        this.logProjectUpdate(event);
        const agentEventIds = this.extractAgentEventIds(event);

        if (agentEventIds.length > 0) {
            logInfo(`Processing ${agentEventIds.length} agent(s)`);
            await this.fetchAndSaveAgents(agentEventIds);
        }

        // Update project configuration if details have changed
        const newTitle = event.tags.find((tag) => tag[0] === "title")?.[1];
        const newDescription = event.content;
        const newRepo = event.tags.find((tag) => tag[0] === "repo")?.[1];

        let configUpdated = false;
        const configPath = path.join(this.projectInfo.projectPath, "config.json");

        try {
            const configContent = await readFile(configPath, "utf-8");
            const configData = JSON.parse(configContent);
            const config = { ...configData };

            if (newTitle && newTitle !== config.title) {
                config.title = newTitle;
                this.projectInfo.title = newTitle;
                configUpdated = true;
            }

            if (newDescription && newDescription !== config.description) {
                config.description = newDescription;
                configUpdated = true;
            }

            if (newRepo && newRepo !== config.repository) {
                config.repository = newRepo;
                this.projectInfo.repository = newRepo;
                configUpdated = true;
            }

            if (configUpdated) {
                await writeJsonFile(configPath, config);
                logInfo(chalk.green("✅ Updated project configuration"));

                // Update the event router's project context
                if (this.eventRouter) {
                    const _updatedContext = {
                        projectId: this.projectInfo.projectEvent.id!,
                        title: config.title,
                        description: config.description,
                        repository: config.repository,
                    };
                    // Note: EventRouter doesn't currently have a method to update context,
                    // but this is where we would call it
                }
            }
        } catch (error) {
            logInfo(chalk.yellow(`⚠️  Could not update config.json: ${formatError(error)}`));
        }
    }

    private logProjectUpdate(event: NDKEvent): void {
        const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled";
        logInfo(`📋 Project event update received: ${title}`);
    }

    private extractAgentEventIds(event: NDKEvent): string[] {
        return event.tags
            .filter((tag) => tag[0] === "agent" && tag[1])
            .map((tag) => tag[1])
            .filter((id): id is string => Boolean(id));
    }

    private async fetchAndSaveAgents(agentEventIds: string[]): Promise<void> {
        const agentsDir = path.join(this.projectInfo.projectPath, ".tenex", "agents");

        // Ensure agents directory exists
        await ensureDirectory(agentsDir);

        for (const agentEventId of agentEventIds) {
            const agentConfigPath = path.join(agentsDir, `${agentEventId}.json`);

            // Check if we already have this agent definition
            if (await fileExists(agentConfigPath)) {
                continue; // Already have it
            }

            try {
                const ndk = getNDK();
                const agentEvent = await ndk.fetchEvent(agentEventId);

                if (agentEvent && agentEvent.kind === EVENT_KINDS.AGENT_CONFIG) {
                    const agentName = agentEvent.tagValue("title") || "unnamed";
                    const agentConfig = {
                        eventId: agentEventId,
                        name: agentName,
                        description: agentEvent.tagValue("description"),
                        role: agentEvent.tagValue("role"),
                        instructions: agentEvent.tagValue("instructions"),
                        version: (() => {
                            const versionStr = agentEvent.tagValue("version");
                            if (!versionStr) return 1;
                            const parsed = Number.parseInt(versionStr, 10);
                            return Number.isNaN(parsed) ? 1 : parsed;
                        })(),
                        publishedAt: agentEvent.created_at,
                        publisher: agentEvent.pubkey,
                    };

                    await writeJsonFile(agentConfigPath, agentConfig);
                    logInfo(chalk.green(`✅ Saved new agent definition: ${agentName}`));

                    // Ensure this agent has an nsec in agents.json
                    await this.ensureAgentNsec(agentName, agentEventId);
                }
            } catch (err) {
                const errorMessage = formatError(err);
                logInfo(chalk.red(`Failed to fetch agent ${agentEventId}: ${errorMessage}`));
            }
        }
    }

    private async handleLLMConfigChange(event: NDKEvent): Promise<void> {
        const timestamp = new Date().toLocaleTimeString();
        logInfo(chalk.gray(`\n[${timestamp}] `) + chalk.magenta("LLM Config Change requested"));

        // Extract target agent pubkey from p-tag
        const pTag = event.tags.find((tag) => tag[0] === "p");
        if (!pTag || !pTag[1]) {
            logInfo(chalk.red("❌ No agent pubkey specified in p-tag"));
            return;
        }

        const targetAgentPubkey = pTag[1];

        // Extract new model configuration from model tag
        const modelTag = event.tags.find((tag) => tag[0] === "model");
        if (!modelTag || !modelTag[1]) {
            logInfo(chalk.red("❌ No model configuration specified in model tag"));
            return;
        }

        const newModelConfig = modelTag[1];

        // Find the agent name by pubkey
        let targetAgentName: string | undefined;
        for (const [name, _config] of this.agentConfigs) {
            const agent = await createAgent({
                projectPath: this.projectInfo.projectPath,
                projectTitle: this.projectInfo.title,
                agentName: name,
                skipIfExists: true,
            });

            if (agent && agent.pubkey === targetAgentPubkey) {
                targetAgentName = name;
                break;
            }
        }

        if (!targetAgentName) {
            logInfo(chalk.red("❌ No agent found with specified pubkey"));
            return;
        }

        // Load current configuration
        const configuration = await configurationService.loadConfiguration(
            this.projectInfo.projectPath
        );

        // Model config must be a named configuration from llms.json
        const newLLMConfig = configuration.llms?.configurations?.[newModelConfig];
        
        if (!newLLMConfig) {
            const availableConfigs = Object.keys(configuration.llms?.configurations || {});
            logInfo(
                chalk.red(
                    `❌ Configuration '${newModelConfig}' not found. Available configurations: ${availableConfigs.join(", ") || "none"}`
                )
            );
            return;
        }
        
        logInfo(chalk.gray("Using configuration: ") + chalk.white(newModelConfig));

        // Update the event router with new LLM provider
        try {
            const { createLLMProvider } = await import(
                "@/agents/infrastructure/LLMProviderAdapter"
            );
            // Use the imported NostrPublisher
            const publisher = new NostrPublisher(getNDK());
            const newProvider = createLLMProvider(newLLMConfig, publisher);
            this.eventRouter.setLLMProvider(newProvider);

            logInfo(chalk.green("✅ LLM configuration updated successfully"));
            logInfo(chalk.gray("Agent:   ") + chalk.white(targetAgentName));
            logInfo(
                chalk.gray("Model:   ") +
                    chalk.white(`${newLLMConfig.provider}:${newLLMConfig.model}${newLLMConfig.enableCaching ? " (with caching)" : ""}`)
            );
        } catch (error) {
            logInfo(chalk.red(`❌ Failed to update LLM configuration: ${formatError(error)}`));
        }
    }

    private async ensureAgentNsec(agentName: string, agentEventId: string): Promise<void> {
        try {
            await createAgent({
                projectPath: this.projectInfo.projectPath,
                projectTitle: this.projectInfo.title,
                agentName,
                agentEventId,
                projectEvent: this.projectInfo.projectEvent,
            });
        } catch (err) {
            const errorMessage = formatError(err);
            logInfo(chalk.red(`Failed to create agent ${agentName}: ${errorMessage}`));
        }
    }

    async cleanup(): Promise<void> {
        // Any cleanup tasks
        logInfo("EventHandler cleanup completed");
    }
}
