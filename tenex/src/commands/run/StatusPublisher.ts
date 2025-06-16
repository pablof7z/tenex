import path from "node:path";
import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { logWarning } from "@tenex/shared/logger";
import chalk from "chalk";
import { formatError } from "../../utils/errors";
import { fs } from "../../utils/fs";
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

            const llmConfigs = await this.getLLMConfigNames(projectInfo.projectPath);

            event.content = JSON.stringify({
                status: "online",
                timestamp: Math.floor(Date.now() / 1000),
                project: projectInfo.title,
                llmConfigs: llmConfigs,
            });

            // Tag the project event properly
            event.tag(projectInfo.projectEvent);

            await this.addAgentPubkeys(event, projectInfo.projectPath);
            event.publish();
        } catch (err) {
            const errorMessage = formatError(err);
            logWarning(`Failed to publish status event2: ${errorMessage}`);
        }
    }

    private async getLLMConfigNames(projectPath: string): Promise<string[]> {
        const llmsPath = path.join(projectPath, ".tenex", "llms.json");

        try {
            const llmsContent = await fs.readFile(llmsPath, "utf-8");
            const llms = JSON.parse(llmsContent);

            // Filter out the 'default' key and return all config names
            // Include both object configs and string references
            const configNames = Object.keys(llms).filter(
                (name) => name !== "default" && llms[name] !== undefined && llms[name] !== null
            );

            return configNames;
        } catch (_err) {
            // If llms.json doesn't exist or can't be read, return empty array
            return [];
        }
    }

    private async addAgentPubkeys(event: NDKEvent, projectPath: string): Promise<void> {
        const agentsPath = path.join(projectPath, ".tenex", "agents.json");

        try {
            const agentsContent = await fs.readFile(agentsPath, "utf-8");
            const agents = JSON.parse(agentsContent);

            for (const [agentName, agentConfig] of Object.entries(agents)) {
                let nsecValue: string | undefined;

                if (typeof agentConfig === "string") {
                    // Handle old format where nsec is stored directly as string
                    nsecValue = agentConfig;
                } else if (
                    typeof agentConfig === "object" &&
                    agentConfig &&
                    "nsec" in agentConfig
                ) {
                    // Handle new format where nsec is stored in object with nsec property
                    nsecValue = agentConfig.nsec;
                }

                if (nsecValue) {
                    const agentSigner = new NDKPrivateKeySigner(nsecValue);
                    const agentPubkey = await agentSigner.user().then((user) => user.pubkey);
                    event.tags.push(["p", agentPubkey, agentName]);
                }
            }
        } catch (_err) {
            logWarning("Could not load agent information for status event");
        }
    }
}
