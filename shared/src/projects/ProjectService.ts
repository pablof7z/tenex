import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type NDK from "@nostr-dev-kit/ndk";
import { NDKProject } from "@nostr-dev-kit/ndk";
import type { ProjectData } from "@tenex/types/projects";
import { nip19 } from "nostr-tools";
import { logger } from "../logger.js";

const execAsync = promisify(exec);

export interface IProjectService {
    fetchProject(naddr: string, ndk: NDK): Promise<NDKProject>;
    createProjectStructure(projectPath: string, project: ProjectData): Promise<void>;
    cloneRepository(repoUrl: string, targetPath: string): Promise<void>;
}

export class ProjectService implements IProjectService {

    async fetchProject(naddr: string, ndk: NDK): Promise<NDKProject> {
        try {
            const decoded = nip19.decode(naddr);
            if (decoded.type !== "naddr") {
                throw new Error("Invalid naddr");
            }

            const { identifier, pubkey, kind, relays } = decoded.data;

            if (kind !== 31933) {
                throw new Error(`Expected kind 31933, got ${kind}`);
            }

            const filter = {
                kinds: [kind as any],
                authors: [pubkey],
                "#d": [identifier],
            };

            // If specific relays are provided, ensure NDK is connected to them
            if (relays && relays.length > 0) {
                // TODO: Consider adding these relays to the NDK pool if needed
                // For now, we'll rely on NDK's default relay set
            }

            const event = await ndk.fetchEvent(filter, {
                closeOnEose: true,
                groupable: false,
            });

            if (!event) {
                throw new Error(`Project not found: ${naddr}`);
            }

            const project = NDKProject.from(event);
            return project;
        } catch (error) {
            logger.error("Failed to fetch project", { error, naddr });
            throw error;
        }
    }

    async createProjectStructure(projectPath: string, project: ProjectData): Promise<void> {
        const tenexDir = path.join(projectPath, ".tenex");

        await fs.mkdir(tenexDir, { recursive: true });
        await fs.mkdir(path.join(tenexDir, "agents"), { recursive: true });
        await fs.mkdir(path.join(tenexDir, "conversations"), { recursive: true });

        const configPath = path.join(tenexDir, "config.json");
        await fs.writeFile(
            configPath,
            JSON.stringify(
                {
                    title: project.title,
                    projectNaddr: project.naddr,
                    createdAt: Date.now(),
                },
                null,
                2
            )
        );

        const agentsPath = path.join(tenexDir, "agents.json");
        if (!(await this.fileExists(agentsPath))) {
            await fs.writeFile(agentsPath, JSON.stringify({}, null, 2));
        }

        logger.info("Project structure created", { projectPath });
    }

    async cloneRepository(repoUrl: string, targetPath: string): Promise<void> {
        try {
            logger.info("Cloning repository", { repoUrl, targetPath });

            const { stderr } = await execAsync(`git clone "${repoUrl}" "${targetPath}"`);

            if (stderr && !stderr.includes("Cloning into")) {
                logger.warn("Git clone warning", { stderr });
            }

            logger.info("Repository cloned successfully");
        } catch (error: any) {
            if (error.message?.includes("already exists and is not an empty directory")) {
                logger.info("Repository already exists", { targetPath });
            } else {
                logger.error("Failed to clone repository", { error, repoUrl });
                throw error;
            }
        }
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}
