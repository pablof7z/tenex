import { promises as fs } from "fs";
import path from "path";
import { type NDK, NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import chalk from "chalk";
import { logWarning } from "../../utils/logger";
import type { ProjectInfo } from "./ProjectLoader";
import { STATUS_INTERVAL_MS, STATUS_KIND } from "./constants";

export class StatusPublisher {
	private statusInterval?: NodeJS.Timeout;

	constructor(private ndk: NDK) {}

	async startPublishing(projectInfo: ProjectInfo): Promise<void> {
		await this.publishStatusEvent(projectInfo);

		this.statusInterval = setInterval(async () => {
			await this.publishStatusEvent(projectInfo);
		}, STATUS_INTERVAL_MS);
	}

	stopPublishing(): void {
		if (this.statusInterval) {
			clearInterval(this.statusInterval);
			this.statusInterval = undefined;
		}
	}

	private async publishStatusEvent(projectInfo: ProjectInfo): Promise<void> {
		try {
			const event = new NDKEvent(this.ndk);
			event.kind = STATUS_KIND;
			event.content = JSON.stringify({
				status: "online",
				timestamp: Math.floor(Date.now() / 1000),
				project: projectInfo.title,
			});

			event.tags = [
				["a", `31933:${projectInfo.projectPubkey}:${projectInfo.projectId}`],
			];

			await this.addAgentPubkeys(event, projectInfo.projectPath);
			await event.publish();

			const timestamp = new Date().toLocaleTimeString();
			console.log(
				chalk.gray(`[${timestamp}] `) + chalk.green("✓ Published status ping"),
			);
		} catch (err: any) {
			logWarning(`Failed to publish status event: ${err.message}`);
		}
	}

	private async addAgentPubkeys(
		event: NDKEvent,
		projectPath: string,
	): Promise<void> {
		const agentsPath = path.join(projectPath, ".tenex", "agents.json");

		try {
			const agentsContent = await fs.readFile(agentsPath, "utf-8");
			const agents = JSON.parse(agentsContent);

			for (const [agentName, nsec] of Object.entries(agents)) {
				if (typeof nsec === "string") {
					const agentSigner = new NDKPrivateKeySigner(nsec);
					const agentPubkey = await agentSigner
						.user()
						.then((user) => user.pubkey);
					event.tags.push(["p", agentPubkey, agentName]);
				}
			}
		} catch (err) {
			logWarning("Could not load agent information for status event");
		}
	}
}
