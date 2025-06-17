import path from "node:path";
import { type RuleMapping, RulesManager } from "@/utils/RulesManager";
import { DefaultSpecCache, type SpecCache } from "@/utils/agents/prompts/SpecCache";
import type NDK from "@nostr-dev-kit/ndk";
import { NDKProject } from "@nostr-dev-kit/ndk";
import { logError, logInfo } from "@tenex/shared/node";
import { configurationService } from "@tenex/shared/services";
import type { ProjectConfig, TenexConfiguration } from "@tenex/types/config";

export interface ProjectRuntimeInfo {
    config: ProjectConfig;
    projectEvent: NDKProject;
    projectPath: string;
    title: string;
    repository: string;
    projectId: string;
    projectPubkey: string;
    projectNsec?: string;
    ruleMappings: RuleMapping[];
    rulesManager: RulesManager;
    specCache: SpecCache;
}

export class ProjectLoader {
    constructor(private ndk: NDK) {}

    async loadProject(projectPath: string): Promise<ProjectRuntimeInfo> {
        const configuration = await this.loadConfiguration(projectPath);
        const config = configuration.config as ProjectConfig;
        const projectEvent = await this.fetchProjectEvent(config.projectNaddr);

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
            config,
            projectPath,
            ruleMappings,
            rulesManager,
            specCache
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
        const projectEvent = await this.ndk.fetchEvent(naddr);

        if (!projectEvent) {
            throw new Error("Failed to fetch project event from Nostr");
        }

        return NDKProject.from(projectEvent);
    }

    private extractProjectInfo(
        projectEvent: NDKProject,
        config: ProjectConfig,
        projectPath: string,
        ruleMappings: RuleMapping[],
        rulesManager: RulesManager,
        specCache: SpecCache
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
            projectPubkey: projectEvent.author.pubkey,
            projectNsec: config.nsec,
            ruleMappings,
            rulesManager,
            specCache,
        };
    }
}
