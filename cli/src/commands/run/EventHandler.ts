import { promises as fs } from "node:fs";
import path from "node:path";
import type { NDK, NDKEvent } from "@nostr-dev-kit/ndk";
import { NDKPrivateKeySigner, NDKEvent as NDKEventClass } from "@nostr-dev-kit/ndk";
import chalk from "chalk";
import { toKebabCase } from "../../../../shared/src/projects";
import { AgentManager } from "../../utils/agents/AgentManager";
import { AgentEventHandler } from "./AgentEventHandler";
import type { ProjectInfo } from "./ProjectLoader";
import { EVENT_KINDS, getEventKindName } from "./constants";

export class EventHandler {
	private agentManager: AgentManager;
	private agentEventHandler: AgentEventHandler;

	constructor(
		private projectInfo: ProjectInfo,
		private ndk: NDK,
	) {
		this.agentManager = new AgentManager(projectInfo.projectPath, projectInfo);
		this.agentEventHandler = new AgentEventHandler();
	}

	async initialize(): Promise<void> {
		this.agentManager.setNDK(this.ndk);
		await this.agentManager.initialize();
	}

	async handleEvent(event: NDKEvent): Promise<void> {
		console.log(chalk.gray("\n📥 Event received:", event.id));

		// Ignore kind 24010 (project status), 24111 (typing indicator), and 24112 (typing stop) events
		if (event.kind === EVENT_KINDS.PROJECT_STATUS || 
		    event.kind === EVENT_KINDS.TYPING_INDICATOR ||
		    event.kind === EVENT_KINDS.TYPING_INDICATOR_STOP) {
			return;
		}

		const timestamp = new Date().toLocaleTimeString();
		const eventKindName = getEventKindName(event.kind);

		console.log(
			chalk.gray(`\n[${timestamp}] `) + chalk.cyan(`${eventKindName} received`),
		);
		console.log(chalk.gray("From:    ") + chalk.white(event.author.npub));
		console.log(chalk.gray("Event:   ") + chalk.gray(event.encode()));

		switch (event.kind) {
			case EVENT_KINDS.STATUS_UPDATE:
				this.handleStatusUpdate(event);
				break;

			case EVENT_KINDS.CHAT_MESSAGE:
			case EVENT_KINDS.CHAT_REPLY:
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

			case 31933: // Project event
				await this.handleProjectEvent(event);
				break;

			default:
				this.handleDefaultEvent(event);
		}
	}

	private handleStatusUpdate(event: NDKEvent): void {
		console.log(
			chalk.gray("Content: ") +
				chalk.white(
					event.content.substring(0, 100) +
						(event.content.length > 100 ? "..." : ""),
				),
		);
	}

	private async handleChatMessage(event: NDKEvent): Promise<void> {
		console.log(
			chalk.gray("Message: ") +
				chalk.white(
					event.content.substring(0, 100) +
						(event.content.length > 100 ? "..." : ""),
				),
		);

		// Extract p-tags to identify mentioned agents
		const pTags = event.tags.filter((tag) => tag[0] === "p");
		const mentionedPubkeys = pTags.map((tag) => tag[1]);

		if (mentionedPubkeys.length > 0) {
			console.log(
				chalk.gray("P-tags:  ") +
					chalk.cyan(`${mentionedPubkeys.length} pubkeys mentioned`),
			);
		}

		// Pass p-tags to the agent manager
		await this.agentManager.handleChatEvent(
			event,
			this.ndk,
			undefined,
			undefined,
			mentionedPubkeys,
		);
	}

	private async handleTask(event: NDKEvent): Promise<void> {
		const title =
			event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled";
		console.log(chalk.gray("Task:    ") + chalk.yellow(title));
		console.log(
			chalk.gray("Content: ") +
				chalk.white(
					event.content.substring(0, 100) +
						(event.content.length > 100 ? "..." : ""),
				),
		);

		// Extract p-tags to identify mentioned agents
		const pTags = event.tags.filter((tag) => tag[0] === "p");
		const mentionedPubkeys = pTags.map((tag) => tag[1]);

		if (mentionedPubkeys.length > 0) {
			console.log(
				chalk.gray("P-tags:  ") +
					chalk.cyan(`${mentionedPubkeys.length} pubkeys mentioned`),
			);
		}

		await this.agentManager.handleTaskEvent(
			event,
			this.ndk,
			undefined,
			undefined,
			mentionedPubkeys,
		);
	}

	private handleProjectStatus(event: NDKEvent): void {
		if (event.author.pubkey !== this.ndk.activeUser?.pubkey) {
			console.log(
				chalk.gray("Status:  ") + chalk.green("Another instance is online"),
			);
		}
	}

	private handleDefaultEvent(event: NDKEvent): void {
		if (event.content) {
			console.log(
				chalk.gray("Content: ") +
					chalk.white(
						event.content.substring(0, 100) +
							(event.content.length > 100 ? "..." : ""),
					),
			);
		}
	}

	private async handleProjectEvent(event: NDKEvent): Promise<void> {
		// Check if this is actually our project event
		const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
		if (
			dTag !== this.projectInfo.projectId ||
			event.author.pubkey !== this.projectInfo.projectPubkey
		) {
			return;
		}

		console.log(chalk.blue("\n📋 Project event update received"));
		console.log(
			chalk.gray("Title:   ") +
				chalk.yellow(
					event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled",
				),
		);

		// Extract agent event IDs from the updated project event
		const agentEventIds = event.tags
			.filter((tag) => tag[0] === "agent" && tag[1])
			.map((tag) => tag[1]);

		if (agentEventIds.length > 0) {
			console.log(
				chalk.gray("Agents:  ") +
					chalk.cyan(`${agentEventIds.length} agent(s) defined`),
			);

			// Fetch and save any new agent definitions
			await this.fetchAndSaveAgents(agentEventIds);
		}

		// Update project metadata if needed
		// TODO: Update title, description, etc. in metadata.json if changed
	}

	private async fetchAndSaveAgents(agentEventIds: string[]): Promise<void> {
		const agentsDir = path.join(
			this.projectInfo.projectPath,
			".tenex",
			"agents",
		);

		// Ensure agents directory exists
		try {
			await fs.access(agentsDir);
		} catch {
			await fs.mkdir(agentsDir, { recursive: true });
		}

		for (const agentEventId of agentEventIds) {
			const agentConfigPath = path.join(agentsDir, `${agentEventId}.json`);

			// Check if we already have this agent definition
			try {
				await fs.access(agentConfigPath);
				continue; // Already have it
			} catch {
				// Need to fetch it
			}

			try {
				const agentEvent = await this.ndk.fetchEvent(agentEventId);

				if (agentEvent && agentEvent.kind === 4199) {
					const agentName = agentEvent.tagValue("title") || "unnamed";
					const agentConfig = {
						eventId: agentEventId,
						name: agentName,
						description: agentEvent.tagValue("description"),
						role: agentEvent.tagValue("role"),
						instructions: agentEvent.tagValue("instructions"),
						version: Number.parseInt(agentEvent.tagValue("version") || "1"),
						publishedAt: agentEvent.created_at,
						publisher: agentEvent.pubkey,
					};

					await fs.writeFile(
						agentConfigPath,
						JSON.stringify(agentConfig, null, 2),
					);
					console.log(
						chalk.green(`✅ Saved new agent definition: ${agentName}`),
					);

					// Ensure this agent has an nsec in agents.json
					await this.ensureAgentNsec(agentName, agentEventId);
				}
			} catch (err: any) {
				console.log(
					chalk.red(`Failed to fetch agent ${agentEventId}: ${err.message}`),
				);
			}
		}
	}

	private async ensureAgentNsec(
		agentName: string,
		agentEventId: string,
	): Promise<void> {
		const agentsJsonPath = path.join(
			this.projectInfo.projectPath,
			".tenex",
			"agents.json",
		);
		const agentKey = toKebabCase(agentName);

		try {
			const content = await fs.readFile(agentsJsonPath, "utf-8");
			const agents = JSON.parse(content);

			// Check if agent already has an nsec
			const agentEntry = agents[agentKey];

			if (!agentEntry) {
				// Generate new nsec for this agent
				const signer = NDKPrivateKeySigner.generate();
				agents[agentKey] = {
					nsec: (signer as any).nsec,
					file: `${agentEventId}.json`,
				};

				await fs.writeFile(agentsJsonPath, JSON.stringify(agents, null, 2));
				console.log(
					chalk.green(
						`✅ Generated nsec for agent: ${agentName} (as '${agentKey}')`,
					),
				);

				// Publish kind:0 profile for the new agent
				try {
					const projectTitle = this.projectInfo.title;
					const fullAgentName = `${agentKey} @ ${projectTitle}`;
					const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(fullAgentName)}`;

					const profileEvent = new NDKEventClass(this.ndk, {
						kind: 0,
						pubkey: signer.pubkey,
						content: JSON.stringify({
							name: fullAgentName,
							display_name: fullAgentName,
							about: `${agentKey} AI agent for ${projectTitle} project`,
							picture: avatarUrl,
							created_at: Math.floor(Date.now() / 1000),
						}),
						tags: [],
					});

					await profileEvent.sign(signer);
					await profileEvent.publish();

					console.log(
						chalk.green(`✅ Published kind:0 profile for ${agentName} agent`),
					);

					// Publish kind 3199 agent request to the project owner
					try {
						const agentRequestEvent = new NDKEventClass(this.ndk, {
							kind: 3199,
							pubkey: signer.pubkey,
							content: `Agent '${fullAgentName}' requesting to join project '${projectTitle}'`,
							tags: [
								["p", this.projectInfo.projectPubkey], // Project owner
								["a", `31933:${this.projectInfo.projectPubkey}:${this.projectInfo.projectId}`], // Project reference
								["agent-name", agentKey],
								["agent-event", agentEventId], // Reference to the NDKAgent event
							],
						});

						await agentRequestEvent.sign(signer);
						await agentRequestEvent.publish();

						console.log(
							chalk.green(`✅ Published kind:3199 agent request for ${agentName}`),
						);
					} catch (err: any) {
						console.log(
							chalk.yellow(
								`⚠️  Failed to publish agent request for ${agentName}: ${err.message}`,
							),
						);
					}
				} catch (err: any) {
					console.log(
						chalk.yellow(
							`⚠️  Failed to publish profile for ${agentName}: ${err.message}`,
						),
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
					await fs.writeFile(agentsJsonPath, JSON.stringify(agents, null, 2));
					console.log(
						chalk.green(`✅ Updated agent ${agentName} to new format`),
					);
				} else if (!agentEntry.file) {
					// New format but missing file reference
					agentEntry.file = `${agentEventId}.json`;
					await fs.writeFile(agentsJsonPath, JSON.stringify(agents, null, 2));
					console.log(
						chalk.green(`✅ Added file reference for agent ${agentName}`),
					);
				}
			}
		} catch (err: any) {
			console.log(chalk.red(`Failed to update agents.json: ${err.message}`));
		}
	}
}
