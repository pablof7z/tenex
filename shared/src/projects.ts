import { exec } from "child_process";
import path from "path";
import { promisify } from "util";
import {
	type NDKArticle,
	NDKEvent,
	NDKPrivateKeySigner,
} from "@nostr-dev-kit/ndk";
import { access, mkdir, readFile, writeFile } from "fs/promises";
import { nip19 } from "nostr-tools";
import {
	type AgentDefinition,
	type AgentsJson,
	fetchAndSaveAgentDefinitions as fetchAgentDefs,
	publishAgentProfile,
	toKebabCase,
	updateAgentConfig,
} from "./agents/index.js";
import { logError, logInfo, logSuccess, logWarning } from "./logger.js";
import { getNDK } from "./nostr.js";
import type { ProjectInfo, ProjectInitOptions } from "./types/index.js";

const execAsync = promisify(exec);

interface ProjectEventData {
	projectEvent: NDKArticle;
	projectName: string;
	projectTitle: string;
	projectDescription: string;
	repoUrl?: string;
	template?: string;
	agentEventIds: string[];
}

// Re-export from agents module for backward compatibility
export {
	toKebabCase,
	updateAgentConfig,
	type AgentsJson,
} from "./agents/index.js";
export type { AgentConfig } from "./agents/index.js";

// Re-export project types
export type { ProjectInitOptions, ProjectInfo } from "./types/index.js";

export function extractProjectIdentifierFromTag(aTag: string): string {
	const parts = aTag.split(":");
	return parts[parts.length - 1];
}

export async function checkProjectExists(
	projectsPath: string,
	projectIdentifier: string,
): Promise<ProjectInfo> {
	const sanitizedName = projectIdentifier;
	console.log({ projectsPath, projectIdentifier });
	const projectPath = path.join(projectsPath, sanitizedName);
	const tenexDir = path.join(projectPath, ".tenex");

	console.log(`Checking if project exists at: ${projectPath}`);

	let exists = false;
	try {
		await access(tenexDir);
		exists = true;
	} catch (err: any) {
		if (err.code !== "ENOENT") {
			throw err;
		}
	}

	return {
		name: sanitizedName,
		path: projectPath,
		exists,
	};
}

async function fetchProjectFromNostr(naddr: string): Promise<ProjectEventData> {
	logInfo(`Fetching project from Nostr: ${naddr}`);
	const ndk = await getNDK();

	const decoded = nip19.decode(naddr);
	if (decoded.type !== "naddr") {
		throw new Error("Invalid project naddr");
	}
	const addressPointer = decoded.data as {
		kind: number;
		pubkey: string;
		identifier: string;
	};
	if (addressPointer.kind !== 31933) {
		throw new Error("Invalid project kind, expected 31933");
	}

	const filter = {
		kinds: [31933],
		authors: [addressPointer.pubkey],
		"#d": [addressPointer.identifier],
	};

	const projectEvents = await ndk.fetchEvents(filter);
	const projectEvent = Array.from(projectEvents)[0] as NDKArticle;

	if (!projectEvent) {
		throw new Error("Project not found");
	}

	const projectName = addressPointer.identifier;

	// Extract agent event IDs from tags
	const agentEventIds = projectEvent.tags
		.filter((tag) => tag[0] === "agent" && tag[1])
		.map((tag) => tag[1]);

	// Try to get title from NDKArticle property first, then from tags
	let projectTitle: string;
	if (projectEvent.title) {
		projectTitle = projectEvent.title;
	} else {
		// Fallback: look for title in tags
		const titleTag = projectEvent.tags.find((tag) => tag[0] === "title");
		projectTitle = titleTag ? titleTag[1] : projectName;
	}

	const projectDescription = projectEvent.content || `Project ${projectName}`;

	const repoTag = projectEvent.tags.find((tag) => tag[0] === "repo");
	let repoUrl: string | undefined;
	if (repoTag && repoTag[1]) {
		repoUrl = repoTag[1];
		logSuccess(`Found project repository: ${repoUrl}`);
	}

	const templateTag = projectEvent.tags.find((tag) => tag[0] === "template");
	let template: string | undefined;
	if (templateTag && templateTag[1]) {
		template = templateTag[1];
		logInfo(`Found template reference: ${template}`);

		if (!repoUrl) {
			repoUrl = await fetchTemplateRepoUrl(template);
		}
	}

	logSuccess(`Loaded project: ${projectTitle}`);

	return {
		projectEvent,
		projectName,
		projectTitle,
		projectDescription,
		repoUrl,
		template,
		agentEventIds,
	};
}

async function fetchTemplateRepoUrl(
	template: string,
): Promise<string | undefined> {
	try {
		logInfo(`Fetching template from Nostr: ${template}`);
		const ndk = await getNDK();

		const templateDecoded = nip19.decode(template);
		if (templateDecoded.type !== "naddr") {
			throw new Error("Invalid template naddr");
		}
		const templatePointer = templateDecoded.data as {
			kind: number;
			pubkey: string;
			identifier: string;
		};

		const templateFilter = {
			kinds: [templatePointer.kind],
			authors: [templatePointer.pubkey],
			"#d": [templatePointer.identifier],
		};

		const templateEvents = await ndk.fetchEvents(templateFilter);
		const templateEvent = Array.from(templateEvents)[0];

		if (templateEvent) {
			const uriTag = templateEvent.tags.find((tag) => tag[0] === "uri");
			const templateRepoTag = templateEvent.tags.find(
				(tag) => tag[0] === "repo",
			);

			if (uriTag && uriTag[1]) {
				const repoUrl = uriTag[1].replace("git+", "");
				logSuccess(`Found template repository: ${repoUrl}`);
				return repoUrl;
			} else if (templateRepoTag && templateRepoTag[1]) {
				const repoUrl = templateRepoTag[1];
				logSuccess(`Found template repository: ${repoUrl}`);
				return repoUrl;
			}
		}
	} catch (templateErr: any) {
		logWarning(`Failed to fetch template: ${templateErr.message}`);
	}
	return undefined;
}

export async function initializeProject(
	options: ProjectInitOptions,
): Promise<string> {
	const { path: projectsDir, naddr } = options;

	let projectData: ProjectEventData;
	try {
		projectData = await fetchProjectFromNostr(naddr);
	} catch (err: any) {
		logError(`Failed to fetch project: ${err.message}`);
		throw err;
	}

	// Generate new nsec for project
	const signer = NDKPrivateKeySigner.generate();
	const nsec = signer.nsec;
	logInfo("Generated new nsec for project");

	const projectPath = path.join(
		projectsDir,
		projectData.projectName.replace(/[^a-zA-Z0-9-_]/g, "-"),
	);
	const tenexDir = path.join(projectPath, ".tenex");
	const agentsConfigPath = path.join(tenexDir, "agents.json");

	try {
		// Create project directory and setup git
		await createProjectDirectory(projectPath, projectData.repoUrl);

		// Create .tenex directory structure
		await createTenexDirectory(tenexDir);

		// Initialize agents config - will be populated after fetching agent definitions
		const agentsConfig: Record<string, { nsec: string; file?: string }> = {
			default: { nsec },
		};

		// Save project metadata
		const projectRepoUrl = await getGitRemoteUrl(projectPath);
		const projectMetadata = {
			title: projectData.projectTitle,
			description: projectData.projectDescription,
			repoUrl: projectRepoUrl,
			projectNaddr: naddr,
			template: projectData.template || null,
		};

		const metadataPath = path.join(tenexDir, "metadata.json");
		await writeFile(metadataPath, JSON.stringify(projectMetadata, null, 2));
		logSuccess(`Created ${metadataPath}`);

		// Fetch and save agent definitions
		if (projectData.agentEventIds.length > 0) {
			await fetchAgentDefs(projectData.agentEventIds, tenexDir, agentsConfig);
		}

		// Save the complete agents.json with all agents
		const agentsJsonContent = JSON.stringify(agentsConfig, null, 2);
		await writeFile(agentsConfigPath, agentsJsonContent);
		logSuccess(
			`Created ${agentsConfigPath} with ${Object.keys(agentsConfig).length} agents`,
		);

		// Publish kind:0 profiles for all agents
		await publishAgentProfiles(agentsConfig, projectData.projectTitle);

		// Create initial project files
		await createInitialProjectFiles(
			projectPath,
			projectData.projectTitle,
			projectData.projectDescription,
			projectData.repoUrl,
		);

		logSuccess(
			`Project "${projectData.projectName}" created successfully at ${projectPath}`,
		);
		return projectPath;
	} catch (err: any) {
		logError(`Failed to create project: ${err.message}`);
		throw err;
	}
}

async function createProjectDirectory(
	projectPath: string,
	repoUrl?: string,
): Promise<void> {
	let projectExists = false;
	try {
		await access(projectPath);
		projectExists = true;
		logInfo(`Using existing project directory: ${projectPath}`);
	} catch (err: any) {
		if (err.code !== "ENOENT") throw err;
	}

	if (!projectExists) {
		logInfo(`Creating project directory: ${projectPath}`);
		await mkdir(projectPath, { recursive: true });
	}

	if (repoUrl && !projectExists) {
		logInfo(`Cloning repository from ${repoUrl}...`);
		try {
			await execAsync(`git clone --depth 1 "${repoUrl}" "${projectPath}"`);
			logSuccess("Repository cloned successfully");
		} catch (err: any) {
			const errorMessage =
				err.stderr || err.message || "Unknown error during clone";
			logError(`Failed to clone repository: ${errorMessage}`);
			await execAsync(`rm -rf "${projectPath}"`);
			throw err;
		}
	} else if (repoUrl && projectExists) {
		logWarning(
			"Repository URL provided but project directory already exists. Skipping clone.",
		);
	} else if (!projectExists) {
		logInfo("Initializing empty git repository...");
		await execAsync(`cd "${projectPath}" && git init`);
	} else {
		try {
			await execAsync(`cd "${projectPath}" && git status`);
			logInfo("Existing git repository detected");
		} catch {
			logInfo("Initializing git repository in existing directory...");
			await execAsync(`cd "${projectPath}" && git init`);
		}
	}
}

async function createTenexDirectory(tenexDir: string): Promise<void> {
	// Check if .tenex already exists (e.g., from cloned template)
	let tenexExists = false;
	try {
		await access(tenexDir);
		tenexExists = true;
		logInfo(`.tenex directory found from template. Updating configuration...`);
	} catch (err: any) {
		if (err.code !== "ENOENT") throw err;
	}

	if (!tenexExists) {
		logInfo("Creating .tenex directory structure...");
		await mkdir(tenexDir, { recursive: true });
	}
}

async function getGitRemoteUrl(projectPath: string): Promise<string | null> {
	try {
		const { stdout } = await execAsync(
			`cd "${projectPath}" && git config --get remote.origin.url`,
		);
		return stdout.trim();
	} catch {
		// No remote origin set yet, that's fine
		return null;
	}
}

async function publishAgentProfiles(
	agentsConfig: AgentsJson,
	projectTitle: string,
): Promise<void> {
	for (const [agentKey, agentData] of Object.entries(agentsConfig)) {
		try {
			await publishAgentProfile(
				agentData.nsec,
				agentKey,
				projectTitle,
				agentKey === "default",
			);
			logSuccess(
				`Published kind:0 profile for agent '${agentKey}' with avatar`,
			);
		} catch (err: any) {
			logWarning(
				`Failed to publish kind:0 profile for agent '${agentKey}': ${err.message}`,
			);
		}
	}
}

async function createInitialProjectFiles(
	projectPath: string,
	projectTitle: string,
	projectDescription: string,
	repoUrl?: string,
): Promise<void> {
	const contextDir = path.join(projectPath, "context");
	await mkdir(contextDir, { recursive: true });

	const specPath = path.join(contextDir, "SPEC.md");
	const specContent = `# Project Specification: ${projectTitle}

${projectDescription}

## Overview

[Add project overview here]

## Requirements

[Add project requirements here]

## Architecture

[Add architecture details here]
`;
	await writeFile(specPath, specContent);
	logSuccess(`Created ${specPath}`);

	if (!repoUrl) {
		const readmePath = path.join(projectPath, "README.md");
		await writeFile(readmePath, `# ${projectTitle}\n\n${projectDescription}`);
	}
}
