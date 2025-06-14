import path from "node:path";
import type NDK from "@nostr-dev-kit/ndk";
import { NDKProject } from "@nostr-dev-kit/ndk";
import { fileSystem, logError, logInfo } from "@tenex/shared/node";
import { type RuleMapping, RulesManager } from "../../utils/RulesManager";
import { DefaultSpecCache, type SpecCache } from "../../utils/agents/prompts/SpecCache";

export interface ProjectMetadata {
    projectNaddr: string;
    title?: string;
    [key: string]: string | undefined;
}

export interface ProjectInfo {
    metadata: ProjectMetadata;
    projectEvent: NDKProject;
    projectPath: string;
    title: string;
    repository: string;
    projectId: string;
    projectPubkey: string;
    ruleMappings: RuleMapping[];
    rulesManager: RulesManager;
    specCache: SpecCache;
}

export class ProjectLoader {
    constructor(private ndk: NDK) {}

    async loadProject(projectPath: string): Promise<ProjectInfo> {
        const metadata = await this.loadMetadata(projectPath);
        const projectEvent = await this.fetchProjectEvent(metadata.projectNaddr);

        // Initialize rules manager
        const rulesManager = new RulesManager(this.ndk, projectPath);
        await rulesManager.initialize();

        // Parse rule mappings from project event
        const ruleMappings = rulesManager.parseRuleTags(projectEvent);

        // Fetch and cache rules
        await rulesManager.fetchAndCacheRules(ruleMappings);

        // Initialize spec cache
        const specCache = new DefaultSpecCache();

        return this.extractProjectInfo(
            projectEvent,
            metadata,
            projectPath,
            ruleMappings,
            rulesManager,
            specCache
        );
    }

    private async loadMetadata(projectPath: string): Promise<ProjectMetadata> {
        const metadataPath = path.join(projectPath, ".tenex", "metadata.json");

        try {
            const metadata = await fileSystem.readJsonFile(metadataPath);

            if (!metadata.projectNaddr) {
                throw new Error("Project metadata missing naddr");
            }

            return metadata;
        } catch (err) {
            if (err instanceof Error && "code" in err && err.code === "ENOENT") {
                logError("Failed to load project metadata. Is this a TENEX project?");
                logInfo("Run 'tenex project init' to initialize a project");
            }
            throw err;
        }
    }

    private async fetchProjectEvent(naddr: string): Promise<NDKProject> {
        const projectEvent = await this.ndk.fetchEvent(naddr);

        if (!projectEvent) {
            throw new Error("Failed to fetch project event from Nostr");
        }

        return NDKProject.from(projectEvent);
    }

    private extractProjectInfo(
        projectEvent: NDKProject,
        metadata: ProjectMetadata,
        projectPath: string,
        ruleMappings: RuleMapping[],
        rulesManager: RulesManager,
        specCache: SpecCache
    ): ProjectInfo {
        const titleTag = projectEvent.tags.find((tag) => tag[0] === "title");
        const repoTag = projectEvent.tags.find((tag) => tag[0] === "repo");
        const dTag = projectEvent.tags.find((tag) => tag[0] === "d");

        return {
            metadata,
            projectEvent,
            projectPath,
            title: titleTag?.[1] || "Untitled Project",
            repository: repoTag?.[1] || "No repository",
            projectId: dTag?.[1] || "",
            projectPubkey: projectEvent.author.pubkey,
            ruleMappings,
            rulesManager,
            specCache,
        };
    }
}
