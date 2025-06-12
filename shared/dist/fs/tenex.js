import path from "path";
import { access, mkdir, readFile, writeFile } from "fs/promises";
import { logError } from "../logger.js";
/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDirectory(dirPath) {
    try {
        await access(dirPath);
    }
    catch (err) {
        if (err.code === "ENOENT") {
            await mkdir(dirPath, { recursive: true });
        }
        else {
            throw err;
        }
    }
}
/**
 * Check if a directory exists
 */
export async function directoryExists(dirPath) {
    try {
        await access(dirPath);
        return true;
    }
    catch (err) {
        if (err.code === "ENOENT") {
            return false;
        }
        throw err;
    }
}
/**
 * Read JSON file with error handling
 */
export async function readJsonFile(filePath) {
    try {
        const content = await readFile(filePath, "utf-8");
        return JSON.parse(content);
    }
    catch (err) {
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
export async function writeJsonFile(filePath, data) {
    await ensureDirectory(path.dirname(filePath));
    await writeFile(filePath, JSON.stringify(data, null, 2));
}
/**
 * Get paths for common .tenex files
 */
export function getTenexPaths(projectPath) {
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
export async function readProjectMetadata(projectPath) {
    const paths = getTenexPaths(projectPath);
    return readJsonFile(paths.metadataJson);
}
/**
 * Write project metadata to .tenex/metadata.json
 */
export async function writeProjectMetadata(projectPath, metadata) {
    const paths = getTenexPaths(projectPath);
    await writeJsonFile(paths.metadataJson, metadata);
}
/**
 * Get project name from metadata or path
 */
export async function getProjectName(projectPath) {
    const metadata = await readProjectMetadata(projectPath);
    if (metadata) {
        return metadata.name || metadata.title || path.basename(projectPath);
    }
    return path.basename(projectPath);
}
/**
 * Check if a project has been initialized (has .tenex directory)
 */
export async function isProjectInitialized(projectPath) {
    const paths = getTenexPaths(projectPath);
    return directoryExists(paths.tenexDir);
}
/**
 * Initialize .tenex directory structure
 */
export async function initializeTenexDirectory(projectPath) {
    const paths = getTenexPaths(projectPath);
    // Create main .tenex directory
    await ensureDirectory(paths.tenexDir);
    // Create subdirectories
    await ensureDirectory(paths.agentsDir);
    await ensureDirectory(paths.rulesDir);
    await ensureDirectory(paths.conversationsDir);
}
