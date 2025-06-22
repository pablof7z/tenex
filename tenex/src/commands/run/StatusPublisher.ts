import type { ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import { STATUS_INTERVAL_MS, STATUS_KIND } from "@/commands/run/constants";
import { getNDK } from "@/nostr/ndkClient";
import { formatError } from "@/utils/errors";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { logWarning } from "@/utils/logger";
import { projectContext, configService } from "@/services";

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
      if (projectContext.isInitialized()) {
        const agents = projectContext.getAllAgents();
        for (const [agentSlug, agent] of agents) {
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

      // Also check if there are agent-specific selections
      for (const [agentName, presetRef] of Object.entries(llms.selection)) {
        if (agentName === "default") continue;

        const preset = presetRef ? llms.presets[presetRef] : undefined;
        if (preset?.model) {
          event.tags.push(["model", preset.model, `${agentName}-default`]);
        }
      }
    } catch (_err) {
      logWarning("Could not load LLM information for status event model tags");
    }
  }
}
