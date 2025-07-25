import { STATUS_INTERVAL_MS, STATUS_KIND } from "@/commands/run/constants";
import { getNDK } from "@/nostr/ndkClient";
import { configService, getProjectContext, isProjectContextInitialized } from "@/services";
import { formatError } from "@/utils/errors";
import { logWarning } from "@/utils/logger";
import { NDKEvent } from "@nostr-dev-kit/ndk";

export class StatusPublisher {
    private statusInterval?: NodeJS.Timeout;

    async startPublishing(projectPath: string): Promise<void> {
        await this.publishStatusEvent(projectPath);

        this.statusInterval = setInterval(async () => {
            await this.publishStatusEvent(projectPath);
        }, STATUS_INTERVAL_MS);
    }

    stopPublishing(): void {
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = undefined;
        }
    }

    private async publishStatusEvent(projectPath: string): Promise<void> {
        try {
            const ndk = getNDK();
            const event = new NDKEvent(ndk);
            event.kind = STATUS_KIND;

            event.content = "";

            // Tag the project event properly
            const projectCtx = getProjectContext();
            event.tag(projectCtx.project);

            await this.addAgentPubkeys(event, projectPath);
            await this.addModelTags(event, projectPath);

            // Sign the event with the project's signer
            await event.sign(projectCtx.signer);
            await event.publish();
        } catch (err) {
            const errorMessage = formatError(err);
            logWarning(`Failed to publish status event: ${errorMessage}`);
        }
    }

    private async addAgentPubkeys(event: NDKEvent, _projectPath: string): Promise<void> {
        try {
            if (isProjectContextInitialized()) {
                const projectCtx = getProjectContext();
                for (const [agentSlug, agent] of projectCtx.agents) {
                    event.tags.push(["agent", agent.pubkey, agentSlug]);
                }
            } else {
                logWarning("ProjectContext not initialized for status event");
            }
        } catch (_err) {
            logWarning("Could not load agent information for status event");
        }
    }

    private async addModelTags(event: NDKEvent, projectPath: string): Promise<void> {
        try {
            const { llms } = await configService.loadConfig(projectPath);

            if (!llms) return;

            // Add model tags for each LLM configuration
            for (const [configName, config] of Object.entries(llms.configurations)) {
                if (!config || !config.model) continue;

                event.tags.push(["model", config.model, configName]);
            }

            // Also check if there are agent-specific defaults
            if (llms.defaults) {
                for (const [agentName, configName] of Object.entries(llms.defaults)) {
                    if (!configName || agentName === "agents" || agentName === "routing") continue;

                    const config = llms.configurations[configName];
                    if (config?.model) {
                        event.tags.push(["model", config.model, `${agentName}-default`]);
                    }
                }
            }
        } catch (_err) {
            logWarning("Could not load LLM information for status event model tags");
        }
    }
}
