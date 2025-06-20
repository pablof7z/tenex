import type { ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import { STATUS_INTERVAL_MS, STATUS_KIND } from "@/commands/run/constants";
import { getNDK } from "@/nostr/ndkClient";
import { formatError } from "@/utils/errors";
import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { logWarning } from "@tenex/shared/logger";
import { configurationService } from "@tenex/shared/services";

export class StatusPublisher {
  private statusInterval?: NodeJS.Timeout;

  async startPublishing(projectInfo: ProjectRuntimeInfo): Promise<void> {
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

  private async publishStatusEvent(projectInfo: ProjectRuntimeInfo): Promise<void> {
    try {
      const ndk = getNDK();
      const event = new NDKEvent(ndk);
      event.kind = STATUS_KIND;

      event.content = "";

      // Tag the project event properly
      event.tag(projectInfo.projectEvent);

      await this.addAgentPubkeys(event, projectInfo.projectPath);
      await this.addModelTags(event, projectInfo.projectPath);

      // Sign the event with the project's signer
      await event.sign(projectInfo.projectSigner);
      await event.publish();
    } catch (err) {
      const errorMessage = formatError(err);
      logWarning(`Failed to publish status event: ${errorMessage}`);
    }
  }

  private async addAgentPubkeys(event: NDKEvent, projectPath: string): Promise<void> {
    try {
      const configuration = await configurationService.loadConfiguration(projectPath);
      const agents = configuration.agents || {};

      for (const [agentName, agentConfig] of Object.entries(agents)) {
        if (agentConfig.nsec) {
          const agentSigner = new NDKPrivateKeySigner(agentConfig.nsec);
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
        if (agentName === "default") continue;

        const config = configRef ? llms.configurations[configRef] : undefined;
        if (config?.model) {
          event.tags.push(["model", config.model, `${agentName}-default`]);
        }
      }
    } catch (_err) {
      logWarning("Could not load LLM information for status event model tags");
    }
  }
}
