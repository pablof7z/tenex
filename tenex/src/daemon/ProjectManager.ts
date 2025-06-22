import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { LLMConfigEditor } from "@/core/llm/LLMConfigEditor";
import { toKebabCase } from "@/utils/string";
// createAgent functionality has been moved to AgentRegistry
import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { NDKProject } from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";
import { configService, ProjectContext } from "@/services";
import type { AgentProfile } from "@/types/agent";
import type { TenexConfig } from "@/types/config";
import type { Agent } from "@/types/llm";
import chalk from "chalk";

const execAsync = promisify(exec);

export interface ProjectData {
  identifier: string;
  pubkey: string;
  naddr: string;
  title: string;
  description?: string;
  repoUrl?: string;
  hashtags: string[];
  agentEventIds: string[];
  createdAt?: number;
  updatedAt?: number;
}

export interface IProjectManager {
  initializeProject(projectPath: string, naddr: string, ndk: NDK): Promise<ProjectData>;
  loadProject(projectPath: string): Promise<ProjectData>;
  ensureProjectExists(identifier: string, naddr: string, ndk: NDK): Promise<string>;
  loadAndInitializeProjectContext(projectPath: string, ndk: NDK): Promise<void>;
}

export class ProjectManager implements IProjectManager {
  private projectsPath: string;

  constructor(projectsPath?: string) {
    this.projectsPath = projectsPath || path.join(process.cwd(), "projects");
  }
  async initializeProject(projectPath: string, naddr: string, ndk: NDK): Promise<ProjectData> {
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

      // Check if LLM configuration is needed
      await this.checkAndRunLLMConfigWizard(projectPath);

      return projectData;
    } catch (error) {
      logger.error("Failed to initialize project", { error });
      throw error;
    }
  }

  async loadProject(projectPath: string): Promise<ProjectData> {
    try {
      const { config } = await configService.loadConfig(projectPath);

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

  async ensureProjectExists(identifier: string, naddr: string, ndk: NDK): Promise<string> {
    const projectPath = path.join(this.projectsPath, identifier);

    // Check if project already exists
    if (await this.projectExists(projectPath)) {
      return projectPath;
    }

    // Initialize the project
    await this.initializeProject(projectPath, naddr, ndk);

    return projectPath;
  }

  async loadAndInitializeProjectContext(projectPath: string, ndk: NDK): Promise<void> {
    try {
      // Load project configuration
      const { config } = await configService.loadConfig(projectPath);

      if (!config.projectNaddr) {
        throw new Error("Project configuration missing projectNaddr");
      }

      // Fetch project from Nostr
      const project = await this.fetchProject(config.projectNaddr, ndk);

      // Get project nsec
      const projectNsec = config.nsec;
      if (!projectNsec) {
        throw new Error("Project nsec not found in configuration");
      }

      // Load agents using AgentRegistry
      const AgentRegistry = (await import("@/agents/AgentRegistry")).AgentRegistry;
      const agentRegistry = new AgentRegistry(projectPath);
      await agentRegistry.loadFromProject();

      // Get all agents from registry
      const agentMap = agentRegistry.getAllAgentsMap();
      const loadedAgents = new Map();

      // Convert to LoadedAgent format with slugs
      for (const [slug, agent] of agentMap.entries()) {
        loadedAgents.set(slug, {
          ...agent,
          slug,
        });
      }

      // Initialize ProjectContext
      ProjectContext.initialize(project, projectNsec, loadedAgents);

      logger.info("ProjectContext initialized successfully", {
        projectTitle: project.tagValue("title"),
        agentCount: loadedAgents.size,
      });
    } catch (error) {
      logger.error("Failed to initialize ProjectContext", { error, projectPath });
      throw error;
    }
  }

  private async fetchProject(naddr: string, ndk: NDK): Promise<NDKProject> {
    const event = await ndk.fetchEvent(naddr);
    if (!event) {
      throw new Error(`Project event not found: ${naddr}`);
    }
    return event as NDKProject;
  }

  private projectToProjectData(project: NDKProject): ProjectData {
    const repoTag = project.tagValue("repo");
    const titleTag = project.tagValue("title");
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
      title: titleTag || "Untitled Project",
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
    const projectConfig: TenexConfig = {
      title: projectData.title,
      description: projectData.description,
      repoUrl: projectData.repoUrl || undefined,
      projectNaddr: projectData.naddr,
      nsec: projectNsec,
      hashtags: projectData.hashtags,
      createdAt: projectData.createdAt,
      updatedAt: projectData.updatedAt,
    };

    await configService.saveProjectConfig(projectPath, projectConfig);

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
    const { agents } = await configService.loadConfig(projectPath);
    const _agents = agents || {};

    // Create agents from agent event IDs
    for (const eventId of project.agentEventIds) {
      const agentFile = path.join(projectPath, ".tenex", "agents", `${eventId}.json`);
      try {
        const agentData = JSON.parse(await fs.readFile(agentFile, "utf-8"));
        const agentName = agentData.name || "agent";

        // Agent creation now handled by AgentRegistry during EventHandler initialization
        logger.info("Agent will be created by AgentRegistry", { agentName, eventId });
      } catch (error) {
        logger.warn("Failed to create agent from event", { error, eventId });
      }
    }

    // Reload configuration to get updated agents
    const { agents: updatedAgents } = await configService.loadConfig(projectPath);

    // If no agents were created from events, create a default agent
    if (!("agents" in updatedAgents) || Object.keys(updatedAgents.agents).length === 0) {
      logger.info("No agents found in project, creating default agent");

      // For now, we don't support nsec in the new agent format
      // This needs to be handled by the agent registry
      const defaultAgents = {
        default: {
          nsec: "", // Will be generated by AgentRegistry
          file: "default.json",
        },
      };
      await configService.saveProjectAgents(projectPath, defaultAgents);
    }
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
      role: "Project Manager",
      description: description || `TENEX project: ${projectName}`,
      capabilities: ["project management", "coordination", "planning"],
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

  private async checkAndRunLLMConfigWizard(projectPath: string): Promise<void> {
    try {
      const { llms: llmsConfig } = await configService.loadConfig(projectPath);

      // Check if there are any LLM configurations
      const hasLLMConfig =
        llmsConfig?.configurations && Object.keys(llmsConfig.configurations).length > 0;

      if (!hasLLMConfig) {
        logger.info(
          chalk.yellow(
            "\n⚠️  No LLM configurations found. Let's set up your LLMs for this project.\n"
          )
        );

        const llmEditor = new LLMConfigEditor(projectPath, false);
        await llmEditor.runOnboardingFlow();
      }
    } catch (error) {
      logger.warn("Failed to check LLM configuration", { error });
      // Don't throw - LLM configuration is not critical for project initialization
    }
  }
}
