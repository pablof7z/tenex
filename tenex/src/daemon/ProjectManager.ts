import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { LLMConfigEditor } from "@/llm/LLMConfigEditor";
import { toKebabCase } from "@/utils/string";
import { ensureTenexInGitignore, initializeGitRepository, isGitRepository } from "@/utils/git";
// createAgent functionality has been moved to AgentRegistry
import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { NDKProject } from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";
import { configService, setProjectContext } from "@/services";
import type { Agent } from "@/agents/types";
import type { TenexConfig } from "@/services/config/types";
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

            // Clone repository if provided, otherwise create directory and init git
            if (projectData.repoUrl) {
                await this.cloneRepository(projectData.repoUrl, projectPath);
            } else {
                // Create project directory
                await fs.mkdir(projectPath, { recursive: true });
                
                // Initialize git repository
                const isGitRepo = await isGitRepository(projectPath);
                if (!isGitRepo) {
                    await initializeGitRepository(projectPath);
                    logger.info("Initialized git repository for new project", { projectPath });
                }
            }

            // Ensure .tenex is in .gitignore
            await ensureTenexInGitignore(projectPath);

            // Generate project nsec and create profile
            const projectNsec = await this.generateNsec();
            await this.createProjectProfile(projectNsec, projectData, ndk);

            // Create project structure (without nsec in config)
            await this.createProjectStructure(projectPath, projectData);

            // Initialize agent registry and create PM agent
            const AgentRegistry = (await import("@/agents/AgentRegistry")).AgentRegistry;
            const agentRegistry = new AgentRegistry(projectPath);
            await agentRegistry.createPMAgent("project-manager", projectNsec);

            // Fetch and save agent definitions
            await this.fetchAndSaveAgentDefinitions(projectPath, projectData, ndk);

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
                title: "Untitled Project", // This should come from NDKProject
                description: config.description,
                repoUrl: config.repoUrl || undefined,
                hashtags: [], // This should come from NDKProject
                agentEventIds: [],
                createdAt: undefined, // This should come from NDKProject
                updatedAt: undefined, // This should come from NDKProject
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

            // Load agents using AgentRegistry
            const AgentRegistry = (await import("@/agents/AgentRegistry")).AgentRegistry;
            const agentRegistry = new AgentRegistry(projectPath);
            await agentRegistry.loadFromProject();

            // Get all agents from registry
            const agentMap = agentRegistry.getAllAgentsMap();
            const loadedAgents = new Map();

            // Set slug on each agent
            for (const [slug, agent] of agentMap.entries()) {
                agent.slug = slug;
                loadedAgents.set(slug, agent);
            }

            // Initialize ProjectContext
            setProjectContext(project, loadedAgents);

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
        projectData: ProjectData
    ): Promise<void> {
        const tenexPath = path.join(projectPath, ".tenex");
        await fs.mkdir(tenexPath, { recursive: true });

        // Create project config (without nsec - it's now in agents.json)
        const projectConfig: TenexConfig = {
            description: projectData.description,
            repoUrl: projectData.repoUrl || undefined,
            projectNaddr: projectData.naddr,
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
                        name: agent.title,
                        role: agent.role,
                        instructions: agent.instructions,
                    };
                    await fs.writeFile(filePath, JSON.stringify(agentData, null, 2));
                    logger.info("Saved agent definition", { eventId, name: agent.title });
                }
            } catch (error) {
                logger.error("Failed to fetch agent definition", { error, eventId });
            }
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
        const signer = NDKPrivateKeySigner.generate();
        return signer.nsec;
    }

    private buildProjectProfile(projectName: string, description?: string) {
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
