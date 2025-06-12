import path from "path";
import { readFile, readdir, stat } from "fs/promises";
import { logError, logInfo } from "../../../shared/src/logger.js";

export interface ProjectSummary {
	name: string;
	path: string;
	hasMetadata: boolean;
	title?: string;
	description?: string;
	naddr?: string;
	agentCount: number;
}

export async function scanProjects(
	projectsPath: string,
): Promise<ProjectSummary[]> {
	const projects: ProjectSummary[] = [];

	try {
		const entries = await readdir(projectsPath, { withFileTypes: true });

		for (const entry of entries) {
			if (!entry.isDirectory()) continue;

			const projectPath = path.join(projectsPath, entry.name);
			const tenexDir = path.join(projectPath, ".tenex");

			try {
				// Check if .tenex directory exists
				await stat(tenexDir);

				const summary: ProjectSummary = {
					name: entry.name,
					path: projectPath,
					hasMetadata: false,
					agentCount: 0,
				};

				// Try to read metadata.json
				try {
					const metadataPath = path.join(tenexDir, "metadata.json");
					const metadataContent = await readFile(metadataPath, "utf-8");
					const metadata = JSON.parse(metadataContent);

					summary.hasMetadata = true;
					summary.title = metadata.title;
					summary.description = metadata.description;
					summary.naddr = metadata.projectNaddr;
				} catch (err) {
					// Metadata file doesn't exist or is invalid
				}

				// Try to count agents
				try {
					const agentsPath = path.join(tenexDir, "agents.json");
					const agentsContent = await readFile(agentsPath, "utf-8");
					const agents = JSON.parse(agentsContent);
					summary.agentCount = Object.keys(agents).length;
				} catch (err) {
					// Agents file doesn't exist or is invalid
				}

				projects.push(summary);
			} catch (err) {
				// Not a valid TENEX project (no .tenex directory)
				continue;
			}
		}

		logInfo(`Found ${projects.length} TENEX projects in ${projectsPath}`);
	} catch (err) {
		logError(`Failed to scan projects directory: ${err}`);
	}

	return projects;
}
