import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { toKebabCase } from "@/utils/agents";
import { createAgent } from "@/utils/agents/createAgent";
import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { NDKProject } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";
import { configurationService } from "@tenex/shared/services";
import type { AgentProfile } from "@tenex/types/agents";
import type {
  GlobalConfig,
  LLMCredentials,
  ProjectConfig,
  TenexConfiguration,
  UnifiedLLMConfig,
} from "@tenex/types/config";
import type { LLMConfig } from "@tenex/types/llm";
import type { Agent, ProjectData } from "@tenex/types/projects";

const execAsync = promisify(exec);

export interface IProjectManager {
  initializeProject(
    projectPath: string,
    naddr: string,
    ndk: NDK,
    llmConfigs?: LLMConfig[]
  ): Promise<ProjectData>;
  loadProject(projectPath: string): Promise<ProjectData>;
  ensureProjectExists(
    identifier: string,
    naddr: string,
    ndk: NDK,
    llmConfigs?: LLMConfig[]
  ): Promise<string>;
}

export class ProjectManager implements IProjectManager {
  async initializeProject(
    projectPath: string,
    naddr: string,
    ndk: NDK,
    llmConfigs?: LLMConfig[]
  ): Promise<ProjectData> {
    try {
      // Fetch project from Nostr
      const project = await this.fetchProject(naddr, ndk);
      const projectData = this.projectToProjectData(project);

      // Clone repository if provided
      if (projectData.repoUrl) {
        await this.cloneRepository(projectData.repoUrl, projectPath);
      }

      // Generate project nsec and create profile
      const projectNsec = await this.generateNsec();
      await this.createProjectProfile(projectNsec, projectData, ndk);

      // Create project structure
      await this.createProjectStructure(projectPath, projectData, projectNsec);

      // Fetch and save agent definitions
      await this.fetchAndSaveAgentDefinitions(projectPath, projectData, ndk);

      // Initialize agents.json with default agent
      await this.initializeAgents(projectPath, projectData);

      // Initialize LLM configuration - use global config if no explicit configs provided
      await this.initializeLLMConfig(projectPath, llmConfigs);

      return projectData;
    } catch (error) {
      logger.error("Failed to initialize project", { error });
      throw error;
    }
  }

  async loadProject(projectPath: string): Promise<ProjectData> {
    try {
      const configuration = await configurationService.loadConfiguration(projectPath);
      const config = configuration.config as ProjectConfig;

      if (!config.projectNaddr) {
        throw new Error("Project configuration missing projectNaddr");
      }

      // For now, return a simplified version without decoding naddr
      // The identifier and pubkey will be filled when the project is fetched from Nostr
      return {
        identifier: config.projectNaddr, // Use naddr as identifier temporarily
        pubkey: "", // Will be filled when fetched from Nostr
        naddr: config.projectNaddr,
        title: config.title || "Untitled Project",
        description: config.description,
        repoUrl: config.repoUrl || undefined,
        hashtags: config.hashtags || [],
        agentEventIds: [],
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      };
    } catch (error) {
      logger.error("Failed to load project", { error, projectPath });
      throw new Error(`Failed to load project from ${projectPath}`);
    }
  }

  async ensureProjectExists(
    identifier: string,
    naddr: string,
    ndk: NDK,
    llmConfigs?: LLMConfig[]
  ): Promise<string> {
    const projectPath = path.join(process.cwd(), "projects", identifier);

    // Check if project already exists
    if (await this.projectExists(projectPath)) {
      return projectPath;
    }

    // Initialize the project
    await this.initializeProject(projectPath, naddr, ndk, llmConfigs);

    return projectPath;
  }

  private async fetchProject(naddr: string, ndk: NDK): Promise<NDKProject> {
    // Fetch the project event directly using NDK
    const event = await ndk.fetchEvent(naddr);

    if (!event) {
      throw new Error("Project not found on Nostr");
    }

    return event as NDKProject;
  }

  private projectToProjectData(project: NDKProject): ProjectData {
    const repoTag = project.tagValue("repo");
    const hashtagTags = project.tags
      .filter((t) => t[0] === "t")
      .map((t) => t[1])
      .filter(Boolean) as string[];

    const agentTags = project.tags
      .filter((t) => t[0] === "agent")
      .map((t) => t[1])
      .filter(Boolean) as string[];

    return {
      identifier: project.dTag || "",
      pubkey: project.pubkey,
      naddr: project.encode(),
      title: project.title || "Untitled Project",
      description: project.description,
      repoUrl: repoTag,
      hashtags: hashtagTags,
      agentEventIds: agentTags,
      createdAt: project.created_at,
      updatedAt: project.created_at,
    };
  }

  private async cloneRepository(repoUrl: string, projectPath: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(projectPath), { recursive: true });
      const { stdout, stderr } = await execAsync(`git clone "${repoUrl}" "${projectPath}"`);
      if (stderr) {
        logger.warn("Git clone warning", { stderr });
      }
      logger.info("Cloned repository", { repoUrl, projectPath, stdout });
    } catch (error) {
      logger.error("Failed to clone repository", { error, repoUrl });
      throw error;
    }
  }

  private async createProjectStructure(
    projectPath: string,
    projectData: ProjectData,
    projectNsec: string
  ): Promise<void> {
    const tenexPath = path.join(projectPath, ".tenex");
    await fs.mkdir(tenexPath, { recursive: true });

    // Create project config
    const projectConfig: ProjectConfig = {
      title: projectData.title,
      description: projectData.description,
      repoUrl: projectData.repoUrl || undefined,
      projectNaddr: projectData.naddr,
      nsec: projectNsec,
      hashtags: projectData.hashtags,
      createdAt: projectData.createdAt,
      updatedAt: projectData.updatedAt,
    };

    const config: TenexConfiguration = {
      config: projectConfig,
      llms: {
        configurations: {},
        defaults: {},
      },
      agents: {},
    };

    await configurationService.saveConfiguration(projectPath, config);

    logger.info("Created project structure with config", { projectPath });
  }

  private async fetchAndSaveAgentDefinitions(
    projectPath: string,
    project: ProjectData,
    ndk: NDK
  ): Promise<void> {
    const agentsDir = path.join(projectPath, ".tenex", "agents");
    await fs.mkdir(agentsDir, { recursive: true });

    for (const eventId of project.agentEventIds) {
      try {
        const agent = await this.fetchAgentDefinition(eventId, ndk);
        if (agent) {
          const filePath = path.join(agentsDir, `${eventId}.json`);
          const agentData = {
            eventId: agent.id,
            name: agent.title,
            description: agent.description,
            role: agent.role,
            instructions: agent.instructions,
            version: agent.version,
            publishedAt: agent.created_at,
            publisher: agent.pubkey,
          };
          await fs.writeFile(filePath, JSON.stringify(agentData, null, 2));
          logger.info("Saved agent definition", { eventId, name: agent.title });
        }
      } catch (error) {
        logger.error("Failed to fetch agent definition", { error, eventId });
      }
    }
  }

  private async initializeAgents(projectPath: string, project: ProjectData): Promise<void> {
    const configuration = await configurationService.loadConfiguration(projectPath);
    const _agents = configuration.agents || {};

    // Create agents from agent event IDs
    for (const eventId of project.agentEventIds) {
      const agentFile = path.join(projectPath, ".tenex", "agents", `${eventId}.json`);
      try {
        const agentData = JSON.parse(await fs.readFile(agentFile, "utf-8"));
        const agentName = agentData.name || "agent";

        await createAgent({
          projectPath,
          projectTitle: project.title || "Project",
          agentName,
          agentEventId: eventId,
        });
      } catch (error) {
        logger.warn("Failed to create agent from event", { error, eventId });
      }
    }

    // Reload configuration to get updated agents
    const updatedConfiguration = await configurationService.loadConfiguration(projectPath);
    const updatedAgents = updatedConfiguration.agents || {};

    // If no agents were created from events, create a default agent
    if (Object.keys(updatedAgents).length === 0) {
      logger.info("No agents found in project, creating default agent");
      updatedAgents.default = {
        nsec: await this.generateNsec(),
      };
      updatedConfiguration.agents = updatedAgents;
      await configurationService.saveConfiguration(projectPath, updatedConfiguration);
    }
  }

  private async initializeLLMConfig(projectPath: string, llmConfigs?: LLMConfig[]): Promise<void> {
    const configuration = await configurationService.loadConfiguration(projectPath);

    // If configs already exist, don't override
    if (
      Object.keys(configuration.llms.configurations).length > 0 ||
      Object.keys(configuration.llms.defaults).length > 0
    ) {
      logger.debug("LLM configuration already exists", { projectPath });
      return;
    }

    // Use provided configs or load from global
    let effectiveConfigs = llmConfigs;
    let globalCredentials: Record<string, LLMCredentials> | undefined;

    if (!effectiveConfigs || effectiveConfigs.length === 0) {
      const globalConfig = await this.loadGlobalConfiguration();
      effectiveConfigs = this.extractLLMConfigsFromUnified(globalConfig.llms);
      globalCredentials = globalConfig.llms.credentials;
    }

    if (!effectiveConfigs || effectiveConfigs.length === 0) {
      logger.info("No LLM configurations available to initialize", { projectPath });
      return;
    }

    // Convert LLMConfig[] to UnifiedLLMConfig
    const unifiedConfig: UnifiedLLMConfig = {
      configurations: {},
      defaults: {},
      credentials: globalCredentials,
    };

    for (const config of effectiveConfigs) {
      const key = `${config.provider}-${config.model}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      unifiedConfig.configurations[key] = config;
    }

    // Set default to first config
    const firstKey = Object.keys(unifiedConfig.configurations)[0];
    if (firstKey) {
      unifiedConfig.defaults.agents = firstKey;
    }

    configuration.llms = unifiedConfig;
    await configurationService.saveConfiguration(projectPath, configuration);

    logger.info("Initialized LLM configuration", {
      projectPath,
      configCount: effectiveConfigs.length,
      defaultKey: unifiedConfig.defaults.default,
    });
  }

  private async loadGlobalConfiguration(): Promise<TenexConfiguration> {
    try {
      return await configurationService.loadConfiguration("", true);
    } catch (error) {
      logger.debug("Could not load global configuration", { error });
      return {
        config: {},
        llms: {
          configurations: {},
          defaults: {},
        },
      };
    }
  }

  private extractLLMConfigsFromUnified(unified: UnifiedLLMConfig): LLMConfig[] {
    return Object.values(unified.configurations);
  }

  private async projectExists(projectPath: string): Promise<boolean> {
    try {
      await fs.access(projectPath);
      const tenexPath = path.join(projectPath, ".tenex");
      await fs.access(tenexPath);
      return true;
    } catch {
      return false;
    }
  }

  private async generateNsec(): Promise<string> {
    const { stdout } = await execAsync("openssl rand -hex 32");
    const privateKeyHex = stdout.trim();
    // NDKPrivateKeySigner can accept hex private key directly
    const signer = new NDKPrivateKeySigner(privateKeyHex);
    return signer.nsec;
  }

  private buildProjectProfile(projectName: string, description?: string): AgentProfile {
    return {
      name: toKebabCase(projectName),
      display_name: `${projectName} Project`,
      about: description || `TENEX project: ${projectName}`,
      picture: `https://api.dicebear.com/7.x/shapes/svg?seed=${projectName}`,
      banner: `https://api.dicebear.com/7.x/shapes/svg?seed=${projectName}-banner`,
      created_at: Math.floor(Date.now() / 1000),
      nip05: `${toKebabCase(projectName)}@tenex.bot`,
      lud16: `${toKebabCase(projectName)}@tenex.bot`,
      website: "https://tenex.bot",
    };
  }

  private async createProjectProfile(
    projectNsec: string,
    projectData: ProjectData,
    ndk: NDK
  ): Promise<void> {
    try {
      const signer = new NDKPrivateKeySigner(projectNsec);
      const profile = this.buildProjectProfile(projectData.title, projectData.description);

      const profileEvent = new NDKEvent(ndk, {
        kind: 0,
        pubkey: signer.pubkey,
        content: JSON.stringify(profile),
        tags: [],
      });

      await profileEvent.sign(signer);
      await profileEvent.publish();

      logger.info("Created project profile", {
        projectName: projectData.title,
        pubkey: signer.pubkey,
      });
    } catch (error) {
      logger.error("Failed to create project profile", {
        error,
        projectName: projectData.title,
      });
      // Don't throw - profile creation is not critical for project initialization
    }
  }

  private async fetchAgentDefinition(
    eventId: string,
    ndk: NDK
  ): Promise<{
    id: string;
    title: string;
    description: string;
    role: string;
    instructions: string;
    version: string;
    created_at: number | undefined;
    pubkey: string;
  } | null> {
    try {
      const filter = {
        ids: [eventId],
        kinds: [4199],
      };

      const event = await ndk.fetchEvent(filter, {
        closeOnEose: true,
        groupable: false,
      });

      if (!event) {
        return null;
      }

      return {
        id: event.id,
        title: event.tagValue("title") || "Unnamed Agent",
        description: event.tagValue("description") || "",
        role: event.tagValue("role") || "assistant",
        instructions: event.tagValue("instructions") || "",
        version: event.tagValue("version") || "1.0.0",
        created_at: event.created_at,
        pubkey: event.pubkey,
      };
    } catch (error) {
      logger.error("Failed to fetch agent event", { error, eventId });
      return null;
    }
  }
}
