import path from "node:path";
import type { ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import { getEventKindName } from "@/commands/run/constants";
import { getNDK } from "@/nostr/ndkClient";
// toKebabCase utility function
import type { Agent } from "@/utils/agents/Agent";
import { AgentManager } from "@/utils/agents/AgentManager";
import { createAgent } from "@/utils/agents/createAgent";
import { formatError } from "@/utils/errors";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { ensureDirectory, fileExists, writeJsonFile } from "@tenex/shared/fs";
import { logInfo } from "@tenex/shared/logger";
import { EVENT_KINDS } from "@tenex/types/events";
import chalk from "chalk";

export class EventHandler {
    private agentManager: AgentManager;

    constructor(private projectInfo: ProjectRuntimeInfo) {
        this.agentManager = new AgentManager(projectInfo.projectPath, projectInfo);
    }

    async initialize(): Promise<void> {
        await this.agentManager.initialize();

        // Set NDK instance on the agent manager so agents can access it
        const ndk = getNDK();
        this.agentManager.setNDK(ndk);
    }

    getAllAgents(): Map<string, Agent> {
        return this.agentManager.getAllAgents();
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

        // Use the default agent to handle chat events
        await this.agentManager.handleChatEvent(
            event,
            "default",
            undefined,
            mentionedPubkeys.filter((pk): pk is string => pk !== undefined)
        );
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

        await this.agentManager.handleTaskEvent(
            event,
            "default",
            undefined,
            mentionedPubkeys.filter((pk): pk is string => pk !== undefined)
        );
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

        // TODO: Update title, description, etc. in config.json if changed
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

        // Find the agent by pubkey
        const agent = this.agentManager.getAgentByPubkeySync(targetAgentPubkey);
        if (!agent) {
            logInfo(chalk.red(`❌ No agent found with pubkey: ${targetAgentPubkey}`));
            logInfo(
                chalk.yellow(
                    "Tip: The agent might not be loaded yet. Make sure it has participated in the conversation."
                )
            );
            return;
        }

        logInfo(chalk.gray("Agent:   ") + chalk.white(agent.name));
        logInfo(chalk.gray("Model:   ") + chalk.white(newModelConfig));

        // Update the agent's LLM configuration
        try {
            await this.agentManager.updateAgentLLMConfig(agent.name, newModelConfig);
            logInfo(chalk.green(`✅ Updated LLM config for ${agent.name} to ${newModelConfig}`));

            // Notify the agent about the change
            agent.notifyLLMConfigChange(newModelConfig);
        } catch (err) {
            const errorMessage = formatError(err);
            logInfo(chalk.red(`❌ Failed to update LLM config: ${errorMessage}`));
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
        // Cleanup agent manager resources
        if (this.agentManager) {
            // Any specific agent manager cleanup needed
        }

        // Any other cleanup tasks
        logInfo("EventHandler cleanup completed");
    }
}
