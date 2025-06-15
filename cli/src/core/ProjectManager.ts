import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import NDK, { type NDKArticle } from "@nostr-dev-kit/ndk";
import { logger, getRelayUrls } from "@tenex/shared";
import { ProjectService } from "@tenex/shared/projects";
import type { AgentsJson } from "@tenex/types/agents";
import type { Agent, ProjectData } from "@tenex/types/projects";
import { nip19 } from "nostr-tools";

const execAsync = promisify(exec);

export interface IProjectManager {
    initializeProject(projectPath: string, naddr: string, ndk: NDK): Promise<ProjectData>;
    loadProject(projectPath: string): Promise<ProjectData>;
    ensureProjectExists(identifier: string, naddr: string, ndk: NDK): Promise<string>;
}

export class ProjectManager implements IProjectManager {
    private projectService: ProjectService;

    constructor() {
        this.projectService = new ProjectService();
    }

    async initializeProject(projectPath: string, naddr: string, ndk: NDK): Promise<ProjectData> {
        try {
            // Fetch project from Nostr
            const article = await this.projectService.fetchProject(naddr, ndk);
            const projectData = this.articleToProjectData(article, naddr);

            // Clone repository if provided
            if (projectData.repoUrl) {
                await this.projectService.cloneRepository(projectData.repoUrl, projectPath);
            }

            // Create project structure
            await this.projectService.createProjectStructure(projectPath, projectData);

            // Fetch and save agent definitions
            await this.fetchAndSaveAgentDefinitions(projectPath, projectData, ndk);

            // Initialize agents.json with default agent
            await this.initializeAgents(projectPath, projectData);

            return projectData;
        } catch (error) {
            logger.error("Failed to initialize project", { error });
            throw error;
        }
    }

    async loadProject(projectPath: string): Promise<ProjectData> {
        const metadataPath = path.join(projectPath, ".tenex", "metadata.json");

        try {
            const metadataContent = await fs.readFile(metadataPath, "utf-8");
            const metadata = JSON.parse(metadataContent);

            if (!metadata.naddr) {
                throw new Error("Project metadata missing naddr");
            }

            // Decode naddr to get project details
            const decoded = nip19.decode(metadata.naddr);
            if (decoded.type !== "naddr") {
                throw new Error("Invalid naddr in metadata");
            }

            const addressPointer = decoded.data as nip19.AddressPointer;
            const { identifier, pubkey } = addressPointer;

            return {
                identifier,
                pubkey,
                naddr: metadata.naddr,
                title: metadata.title || "Untitled Project",
                description: metadata.description,
                repoUrl: metadata.repoUrl,
                hashtags: metadata.hashtags || [],
                agentEventIds: [],
                createdAt: metadata.createdAt,
                updatedAt: metadata.updatedAt,
            };
        } catch (error) {
            logger.error("Failed to load project", { error, projectPath });
            throw new Error(`Failed to load project from ${projectPath}`);
        }
    }

    async ensureProjectExists(identifier: string, naddr: string, ndk: NDK): Promise<string> {
        const projectPath = path.join(process.cwd(), "projects", identifier);

        // Check if project already exists
        if (await this.projectExists(projectPath)) {
            logger.info("Project already exists", { projectPath });
            return projectPath;
        }

        // Initialize the project
        logger.info("Initializing new project", { identifier, naddr });
        await this.initializeProject(projectPath, naddr, ndk);

        return projectPath;
    }

    private articleToProjectData(article: NDKArticle, naddr: string): ProjectData {
        const repoTag = article.tagValue("repo");
        const hashtagTags = article.tags
            .filter((t) => t[0] === "t")
            .map((t) => t[1])
            .filter(Boolean) as string[];

        const agentTags = article.tags
            .filter((t) => t[0] === "agent")
            .map((t) => t[1])
            .filter(Boolean) as string[];

        return {
            identifier: article.dTag || "",
            pubkey: article.pubkey,
            naddr,
            title: article.title || "Untitled Project",
            description: article.summary || article.content,
            repoUrl: repoTag,
            hashtags: hashtagTags,
            agentEventIds: agentTags,
            defaultAgent: agentTags[0],
            createdAt: article.created_at,
            updatedAt: article.created_at,
        };
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
        const agentsPath = path.join(projectPath, ".tenex", "agents.json");
        const agents: AgentsJson = {};

        // Create default agent
        const projectNsec = await this.generateNsec();
        agents.default = {
            nsec: projectNsec,
            file: project.defaultAgent,
        };

        // Create other agents from agent event IDs
        for (const eventId of project.agentEventIds) {
            const agentFile = path.join(projectPath, ".tenex", "agents", `${eventId}.json`);
            try {
                const agentData = JSON.parse(await fs.readFile(agentFile, "utf-8"));
                const agentName = this.toKebabCase(agentData.name || "agent");
                if (agentName !== "default") {
                    agents[agentName] = {
                        nsec: await this.generateNsec(),
                        file: eventId,
                    };
                }
            } catch (error) {
                logger.warn("Failed to load agent file", { error, eventId });
            }
        }

        await fs.writeFile(agentsPath, JSON.stringify(agents, null, 2));
    }

    private async loadAgents(projectPath: string, _project: ProjectData): Promise<Agent[]> {
        const agentsPath = path.join(projectPath, ".tenex", "agents.json");
        const agentsJson: AgentsJson = JSON.parse(await fs.readFile(agentsPath, "utf-8"));

        const agents: Agent[] = [];

        for (const [name, config] of Object.entries(agentsJson)) {
            const agent: Agent = {
                name,
                nsec: config.nsec,
                eventId: config.file,
            };

            // Load additional agent data if file reference exists
            if (config.file) {
                try {
                    const agentFile = path.join(
                        projectPath,
                        ".tenex",
                        "agents",
                        `${config.file}.json`
                    );
                    const agentData = JSON.parse(await fs.readFile(agentFile, "utf-8"));
                    agent.display_name = agentData.name;
                    agent.description = agentData.description;
                    agent.role = agentData.role;
                    agent.instructions = agentData.instructions;
                    agent.version = agentData.version;
                } catch (error) {
                    logger.warn("Failed to load agent data", { error, name });
                }
            }

            agents.push(agent);
        }

        return agents;
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
        // Convert hex string to Uint8Array
        const privateKeyBytes = new Uint8Array(
            privateKeyHex.match(/.{1,2}/g)!.map((byte) => Number.parseInt(byte, 16))
        );
        return nip19.nsecEncode(privateKeyBytes);
    }

    private toKebabCase(str: string): string {
        return str
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
    }

    private async fetchAgentDefinition(eventId: string, ndk: NDK): Promise<any> {
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
