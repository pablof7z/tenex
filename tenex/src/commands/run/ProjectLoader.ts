import path from "node:path";
import { getNDK } from "@/nostr/ndkClient";
import { RulesManager } from "@/utils/RulesManager";
import { NDKPrivateKeySigner, NDKProject } from "@nostr-dev-kit/ndk";
import * as fileSystem from "@tenex/shared/fs";
import { logError, logInfo } from "@tenex/shared/node";
import { configurationService } from "@tenex/shared/services";
import type { ProjectConfig, TenexConfiguration } from "@tenex/types/config";
import { EVENT_KINDS } from "@tenex/types/events";
import { nip19 } from "nostr-tools";
import { generateSecretKey } from "nostr-tools";

export interface Agent {
  name: string;
  description: string;
  role: string;
  instructions: string;
  eventId: string;
  pubkey: string;
  signer: NDKPrivateKeySigner;
}

export interface ProjectRuntimeInfo {
  config: ProjectConfig;
  projectEvent: NDKProject;
  projectPath: string;
  title: string;
  repository: string;
  projectId: string;
  projectSigner: NDKPrivateKeySigner;
  agents: Map<string, Agent>;
  rulesManager: RulesManager;
}

export class ProjectLoader {
  async loadProject(projectPath: string): Promise<ProjectRuntimeInfo> {
    const configuration = await this.loadConfiguration(projectPath);
    const config = configuration.config as ProjectConfig;
    const projectEvent = await this.fetchProjectEvent(config.projectNaddr);

    // Load agents
    const agents = await this.loadAgents(projectEvent, configuration, projectPath);

    // Initialize rules manager
    const rulesManager = new RulesManager(projectPath);
    await rulesManager.initialize();

    // Parse rule mappings from project event
    const ruleMappings = rulesManager.parseRuleTags(projectEvent);

    // Fetch and cache rules
    await rulesManager.fetchAndCacheRules(ruleMappings);

    // Create project signer
    const projectSigner = config.nsec
      ? new NDKPrivateKeySigner(config.nsec)
      : NDKPrivateKeySigner.generate();

    return this.extractProjectInfo(
      projectEvent,
      config,
      projectPath,
      projectSigner,
      agents,
      rulesManager
    );
  }

  private async loadConfiguration(projectPath: string): Promise<TenexConfiguration> {
    try {
      const configuration = await configurationService.loadConfiguration(projectPath);
      const config = configuration.config as ProjectConfig;

      if (!config.projectNaddr) {
        throw new Error("Project configuration missing projectNaddr");
      }

      return configuration;
    } catch (err) {
      if (err instanceof Error && "code" in err && err.code === "ENOENT") {
        logError("Failed to load project configuration. Is this a TENEX project?");
        logInfo("Run 'tenex project init' to initialize a project");
      }
      throw err;
    }
  }

  private async fetchProjectEvent(naddr: string): Promise<NDKProject> {
    const projectEvent = await getNDK().fetchEvent(naddr);

    if (!projectEvent) {
      throw new Error("Failed to fetch project event from Nostr");
    }

    return NDKProject.from(projectEvent);
  }

  private async loadAgents(
    projectEvent: NDKProject,
    configuration: TenexConfiguration,
    projectPath: string
  ): Promise<Map<string, Agent>> {
    const agents = new Map<string, Agent>();

    // Ensure agents directory exists
    const agentsDir = path.join(projectPath, ".tenex", "agents");
    await fileSystem.ensureDirectory(agentsDir);

    // Get agent event IDs from project tags
    const agentTags = projectEvent.tags.filter((tag) => tag[0] === "agent");

    // TODO: This needs to be refactored to work with the new agent system
    const legacyAgentsConfig: Record<string, { nsec: string; file: string }> = {};

    for (const tag of agentTags) {
      const eventId = tag[1];
      if (!eventId) continue;

      try {
        // Fetch agent event to get name, description, role
        const agentEvent = await getNDK().fetchEvent(eventId);
        if (!agentEvent || agentEvent.kind !== EVENT_KINDS.AGENT_CONFIG) {
          continue;
        }

        const agentName = agentEvent.tagValue("title") || "unnamed";
        const description = agentEvent.tagValue("description") || "";
        const role = agentEvent.tagValue("role") || "";

        // Cache agent definition
        const agentDefinition = {
          eventId: eventId,
          name: agentName,
          description: description,
          role: role,
          instructions: agentEvent.content || "",
          version: agentEvent.tagValue("ver") || "1",
          systemPrompt: agentEvent.content || "",
        };

        const agentFile = path.join(agentsDir, `${eventId}.json`);
        await fileSystem.writeJsonFile(agentFile, agentDefinition);

        // For now, create a temporary agent entry with generated nsec
        const privateKey = generateSecretKey();
        const nsec = nip19.nsecEncode(privateKey);
        const signer = new NDKPrivateKeySigner(nsec);

        legacyAgentsConfig[agentName] = {
          nsec,
          file: `${eventId}.json`,
        };
        agents.set(agentName, {
          name: agentName,
          description,
          role,
          instructions: agentEvent.content || "",
          eventId,
          pubkey: signer.pubkey,
          signer,
        });
      } catch (error) {
        logError(`Failed to load agent signer for event ${eventId}:`, error);
      }
    }

    return agents;
  }

  private extractProjectInfo(
    projectEvent: NDKProject,
    config: ProjectConfig,
    projectPath: string,
    projectSigner: NDKPrivateKeySigner,
    agents: Map<string, Agent>,
    rulesManager: RulesManager
  ): ProjectRuntimeInfo {
    const titleTag = projectEvent.tags.find((tag) => tag[0] === "title");
    const repoTag = projectEvent.tags.find((tag) => tag[0] === "repo");
    const dTag = projectEvent.tags.find((tag) => tag[0] === "d");

    return {
      config,
      projectEvent,
      projectPath,
      title: titleTag?.[1] || config.title || "Untitled Project",
      repository: repoTag?.[1] || config.repoUrl || "No repository",
      projectId: dTag?.[1] || "",
      projectSigner,
      agents,
      rulesManager,
    };
  }
}
