import { promises as fs } from "fs";
import path from "path";
import type { NDK, NDKEvent } from "@nostr-dev-kit/ndk";
import { type RuleMapping, RulesManager } from "../../utils/RulesManager";
import { logError, logInfo } from "../../utils/logger";

export interface ProjectMetadata {
	projectNaddr: string;
	title?: string;
	[key: string]: any;
}

export interface ProjectInfo {
	metadata: ProjectMetadata;
	projectEvent: NDKEvent;
	projectPath: string;
	title: string;
	repository: string;
	projectId: string;
	projectPubkey: string;
	ruleMappings: RuleMapping[];
	rulesManager: RulesManager;
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

		return this.extractProjectInfo(
			projectEvent,
			metadata,
			projectPath,
			ruleMappings,
			rulesManager,
		);
	}

	private async loadMetadata(projectPath: string): Promise<ProjectMetadata> {
		const metadataPath = path.join(projectPath, ".tenex", "metadata.json");

		try {
			const content = await fs.readFile(metadataPath, "utf-8");
			const metadata = JSON.parse(content);

			if (!metadata.projectNaddr) {
				throw new Error("Project metadata missing naddr");
			}

			return metadata;
		} catch (err) {
			if ((err as any).code === "ENOENT") {
				logError("Failed to load project metadata. Is this a TENEX project?");
				logInfo("Run 'tenex project init' to initialize a project");
			}
			throw err;
		}
	}

	private async fetchProjectEvent(naddr: string): Promise<NDKEvent> {
		const projectEvent = await this.ndk.fetchEvent(naddr);

		if (!projectEvent) {
			throw new Error("Failed to fetch project event from Nostr");
		}

		return projectEvent;
	}

	private extractProjectInfo(
		projectEvent: NDKEvent,
		metadata: ProjectMetadata,
		projectPath: string,
		ruleMappings: RuleMapping[],
		rulesManager: RulesManager,
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
		};
	}
}
