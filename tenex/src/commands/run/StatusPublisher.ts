import type { ProjectInfo } from "@/commands/run/ProjectLoader";
import { STATUS_INTERVAL_MS, STATUS_KIND } from "@/commands/run/constants";
import { getNDK } from "@/nostr/ndkClient";
import { formatError } from "@/utils/errors";
import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { logWarning } from "@tenex/shared/logger";
import { configurationService } from "@tenex/shared/services";
import type { UnifiedLLMConfig } from "@tenex/types/config";
import type { LLMConfig } from "@tenex/types/llm";
import chalk from "chalk";

export class StatusPublisher {
    private statusInterval?: NodeJS.Timeout;

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
            const ndk = getNDK();
            const event = new NDKEvent(ndk);
            event.kind = STATUS_KIND;

            const llmConfigs = await this.getLLMConfigurations(projectInfo.projectPath);

            event.content = JSON.stringify({
                status: "online",
                timestamp: Math.floor(Date.now() / 1000),
                project: projectInfo.title,
                llmConfigs: llmConfigs,
            });

            // Tag the project event properly
            event.tag(projectInfo.projectEvent);

            await this.addAgentPubkeys(event, projectInfo.projectPath);
            await this.addModelTags(event, projectInfo.projectPath);
            event.publish();
        } catch (err) {
            const errorMessage = formatError(err);
            logWarning(`Failed to publish status event2: ${errorMessage}`);
        }
    }

    private async getLLMConfigurations(
        projectPath: string
    ): Promise<Record<string, Partial<LLMConfig> | UnifiedLLMConfig["defaults"]>> {
        try {
            const configuration = await configurationService.loadConfiguration(projectPath);
            const llms = configuration.llms;

            // Create a sanitized version of the configurations
            const sanitizedConfigs: Record<
                string,
                Partial<LLMConfig> | UnifiedLLMConfig["defaults"]
            > = {};

            // Add defaults
            sanitizedConfigs.defaults = llms.defaults;

            // Add configurations without sensitive data
            for (const [configName, config] of Object.entries(llms.configurations)) {
                if (!config) continue;

                // Copy the config but exclude sensitive data
                const sanitizedConfig = { ...config };
                sanitizedConfig.apiKey = undefined;
                sanitizedConfigs[configName] = sanitizedConfig;
            }

            return sanitizedConfigs;
        } catch (_err) {
            // If configuration doesn't exist or can't be read, return empty object
            return {};
        }
    }

    private async getLLMConfigNames(projectPath: string): Promise<string[]> {
        try {
            const configuration = await configurationService.loadConfiguration(projectPath);
            const llms = configuration.llms;

            // Return all configuration names
            return Object.keys(llms.configurations);
        } catch (_err) {
            // If configuration doesn't exist or can't be read, return empty array
            return [];
        }
    }

    private async addAgentPubkeys(event: NDKEvent, projectPath: string): Promise<void> {
        try {
            const configuration = await configurationService.loadConfiguration(projectPath);
            const agents = configuration.agents || {};

            for (const [agentName, agentConfig] of Object.entries(agents)) {
                let nsecValue: string | undefined;

                // Handle both string and object agent configs
                if (typeof agentConfig === "string") {
                    nsecValue = agentConfig;
                } else if (typeof agentConfig === "object" && agentConfig?.nsec) {
                    nsecValue = agentConfig.nsec;
                }

                if (nsecValue) {
                    const agentSigner = new NDKPrivateKeySigner(nsecValue);
                    const agentPubkey = agentSigner.pubkey;
                    event.tags.push(["p", agentPubkey, agentName]);
                }
            }
        } catch (_err) {
            logWarning("Could not load agent information for status event");
        }
    }

    private async addModelTags(event: NDKEvent, projectPath: string): Promise<void> {
        try {
            const configuration = await configurationService.loadConfiguration(projectPath);
            const llms = configuration.llms;

            // Add model tags for each LLM configuration
            for (const [configName, config] of Object.entries(llms.configurations)) {
                if (!config || !config.model) continue;

                event.tags.push(["model", config.model, configName]);
            }

            // Also check if there are agent-specific defaults
            for (const [agentName, configRef] of Object.entries(llms.defaults)) {
                if (agentName === "default" || agentName === "orchestrator") continue;

                const config = llms.configurations[configRef];
                if (config?.model) {
                    event.tags.push(["model", config.model, `${agentName}-default`]);
                }
            }
        } catch (_err) {
            logWarning("Could not load LLM information for status event model tags");
        }
    }
}
