import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { logError, logWarning } from "../logger.js";
import type { ProjectMetadata } from "../types/index.js";

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
	try {
		await access(dirPath);
	} catch (err: any) {
		if (err.code === "ENOENT") {
			await mkdir(dirPath, { recursive: true });
		} else {
			throw err;
		}
	}
}

/**
 * Check if a directory exists
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
	try {
		await access(dirPath);
		return true;
	} catch (err: any) {
		if (err.code === "ENOENT") {
			return false;
		}
		throw err;
	}
}

/**
 * Read JSON file with error handling
 */
export async function readJsonFile<T>(filePath: string): Promise<T | null> {
	try {
		const content = await readFile(filePath, "utf-8");
		return JSON.parse(content) as T;
	} catch (err: any) {
		if (err.code === "ENOENT") {
			return null;
		}
		logError(`Failed to read JSON file ${filePath}: ${err.message}`);
		throw err;
	}
}

/**
 * Write JSON file with pretty printing
 */
export async function writeJsonFile<T>(
	filePath: string,
	data: T,
): Promise<void> {
	await ensureDirectory(path.dirname(filePath));
	await writeFile(filePath, JSON.stringify(data, null, 2));
}

/**
 * Get paths for common .tenex files
 */
export function getTenexPaths(projectPath: string) {
	const tenexDir = path.join(projectPath, ".tenex");
	return {
		tenexDir,
		agentsJson: path.join(tenexDir, "agents.json"),
		metadataJson: path.join(tenexDir, "metadata.json"),
		llmsJson: path.join(tenexDir, "llms.json"),
		agentsDir: path.join(tenexDir, "agents"),
		rulesDir: path.join(tenexDir, "rules"),
		conversationsDir: path.join(tenexDir, "conversations"),
	};
}

/**
 * Read project metadata from .tenex/metadata.json
 */
export async function readProjectMetadata(
	projectPath: string,
): Promise<ProjectMetadata | null> {
	const paths = getTenexPaths(projectPath);
	return readJsonFile<ProjectMetadata>(paths.metadataJson);
}

/**
 * Write project metadata to .tenex/metadata.json
 */
export async function writeProjectMetadata(
	projectPath: string,
	metadata: ProjectMetadata,
): Promise<void> {
	const paths = getTenexPaths(projectPath);
	await writeJsonFile(paths.metadataJson, metadata);
}

/**
 * Get project name from metadata or path
 */
export async function getProjectName(projectPath: string): Promise<string> {
	const metadata = await readProjectMetadata(projectPath);
	if (metadata) {
		return metadata.name || metadata.title || path.basename(projectPath);
	}
	return path.basename(projectPath);
}

/**
 * Check if a project has been initialized (has .tenex directory)
 */
export async function isProjectInitialized(
	projectPath: string,
): Promise<boolean> {
	const paths = getTenexPaths(projectPath);
	return directoryExists(paths.tenexDir);
}

/**
 * Initialize .tenex directory structure
 */
export async function initializeTenexDirectory(
	projectPath: string,
): Promise<void> {
	const paths = getTenexPaths(projectPath);

	// Create main .tenex directory
	await ensureDirectory(paths.tenexDir);

	// Create subdirectories
	await ensureDirectory(paths.agentsDir);
	await ensureDirectory(paths.rulesDir);
	await ensureDirectory(paths.conversationsDir);
}
