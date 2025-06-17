import path from "node:path";
import { AgentEventHandler } from "@/commands/run/AgentEventHandler";
import type { ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import { getEventKindName } from "@/commands/run/constants";
import { getNDK } from "@/nostr/ndkClient";
// toKebabCase utility function
import type { Agent } from "@/utils/agents/Agent";
import { AgentManager } from "@/utils/agents/AgentManager";
import { formatError } from "@/utils/errors";
import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { ensureDirectory, fileExists, readJsonFile, writeJsonFile } from "@tenex/shared/fs";
import { logInfo } from "@tenex/shared/logger";
import type { AgentsJson } from "@tenex/types/agents";
import { EVENT_KINDS } from "@tenex/types/events";
import chalk from "chalk";

export class EventHandler {
    private agentManager: AgentManager;
    private agentEventHandler: AgentEventHandler;

    constructor(private projectInfo: ProjectRuntimeInfo) {
        this.agentManager = new AgentManager(projectInfo.projectPath, projectInfo);
        this.agentEventHandler = new AgentEventHandler();
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

            case EVENT_KINDS.AGENT_CONFIG:
                await this.agentEventHandler.handleAgentEvent(event, this.projectInfo);
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
        if (!this.isOurProjectEvent(event)) {
            return;
        }

        this.logProjectUpdate(event);
        const agentEventIds = this.extractAgentEventIds(event);

        if (agentEventIds.length > 0) {
            logInfo(`Processing ${agentEventIds.length} agent(s)`);
            await this.fetchAndSaveAgents(agentEventIds);
        }

        // TODO: Update title, description, etc. in config.json if changed
    }

    private isOurProjectEvent(event: NDKEvent): boolean {
        const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
        return (
            dTag === this.projectInfo.projectId &&
            event.author.pubkey === this.projectInfo.projectPubkey
        );
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
        // Only accept from project owner
        if (event.author.pubkey !== this.projectInfo.projectPubkey) {
            logInfo(chalk.yellow("⚠️  Ignoring LLM config change from non-project owner"));
            return;
        }

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

        logInfo(chalk.gray("Agent:   ") + chalk.white(agent.getName()));
        logInfo(chalk.gray("Model:   ") + chalk.white(newModelConfig));

        // Update the agent's LLM configuration
        try {
            await this.agentManager.updateAgentLLMConfig(agent.getName(), newModelConfig);
            logInfo(
                chalk.green(`✅ Updated LLM config for ${agent.getName()} to ${newModelConfig}`)
            );

            // Notify the agent about the change
            agent.notifyLLMConfigChange(newModelConfig);
        } catch (err) {
            const errorMessage = formatError(err);
            logInfo(chalk.red(`❌ Failed to update LLM config: ${errorMessage}`));
        }
    }

    private toKebabCase(str: string): string {
        return str
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    private async ensureAgentNsec(agentName: string, agentEventId: string): Promise<void> {
        const agentsJsonPath = path.join(this.projectInfo.projectPath, ".tenex", "agents.json");
        const agentKey = this.toKebabCase(agentName);

        try {
            const agents: AgentsJson = (await readJsonFile(agentsJsonPath)) || {};

            // Check if agent already has an nsec
            const agentEntry = agents[agentKey];

            if (!agentEntry) {
                // Generate new nsec for this agent
                const signer = NDKPrivateKeySigner.generate();
                if (!signer.privateKey) {
                    throw new Error("Failed to generate private key for agent");
                }
                agents[agentKey] = {
                    nsec: signer.privateKey,
                    file: `${agentEventId}.json`,
                };

                await writeJsonFile(agentsJsonPath, agents);
                logInfo(
                    chalk.green(`✅ Generated nsec for agent: ${agentName} (as '${agentKey}')`)
                );

                // Publish kind:0 profile for the new agent
                try {
                    const projectTitle = this.projectInfo.title;
                    const fullAgentName = `${agentKey} @ ${projectTitle}`;
                    const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(fullAgentName)}`;

                    const ndk = getNDK();
                    const profileEvent = new NDKEvent(ndk, {
                        kind: 0,
                        pubkey: signer.pubkey,
                        content: JSON.stringify({
                            name: fullAgentName,
                            display_name: fullAgentName,
                            about: `${agentKey} AI agent for ${projectTitle} project`,
                            bot: true,
                            picture: avatarUrl,
                            created_at: Math.floor(Date.now() / 1000),
                        }),
                        tags: [],
                    });

                    await profileEvent.sign(signer);
                    await profileEvent.publish();

                    logInfo(chalk.green(`✅ Published kind:0 profile for ${agentName} agent`));

                    // Publish kind 3199 agent request to the project owner
                    try {
                        const agentRequestEvent = new NDKEvent(ndk, {
                            kind: EVENT_KINDS.AGENT_REQUEST,
                            tags: [
                                ["agent-name", agentKey],
                                ["e", agentEventId], // Reference to the NDKAgent event
                            ],
                        });

                        // Tag the project properly
                        agentRequestEvent.tag(this.projectInfo.projectEvent);

                        // Tag the author of the project (the owner)
                        agentRequestEvent.tag(this.projectInfo.projectEvent.author);

                        await agentRequestEvent.sign(signer);
                        await agentRequestEvent.publish();

                        logInfo(
                            chalk.green(`✅ Published kind:3199 agent request for ${agentName}`)
                        );
                    } catch (err) {
                        const errorMessage = formatError(err);
                        logInfo(
                            chalk.yellow(
                                `⚠️  Failed to publish agent request for ${agentName}: ${errorMessage}`
                            )
                        );
                    }
                } catch (err) {
                    const errorMessage = formatError(err);
                    logInfo(
                        chalk.yellow(
                            `⚠️  Failed to publish profile for ${agentName}: ${errorMessage}`
                        )
                    );
                }
            } else {
                // Check if we need to update the file reference
                if (typeof agentEntry === "string") {
                    // Old format - convert to new format
                    agents[agentKey] = {
                        nsec: agentEntry,
                        file: `${agentEventId}.json`,
                    };
                    await writeJsonFile(agentsJsonPath, agents);
                    logInfo(chalk.green(`✅ Updated agent ${agentName} to new format`));
                } else if (!agentEntry.file) {
                    // New format but missing file reference
                    agentEntry.file = `${agentEventId}.json`;
                    await writeJsonFile(agentsJsonPath, agents);
                    logInfo(chalk.green(`✅ Added file reference for agent ${agentName}`));
                }
            }
        } catch (err) {
            const errorMessage = formatError(err);
            logInfo(chalk.red(`Failed to update agents.json: ${errorMessage}`));
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
