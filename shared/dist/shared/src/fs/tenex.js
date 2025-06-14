import path from "node:path";
import { ensureDirectory, directoryExists, readJsonFile, writeJsonFile } from "./filesystem.js";
// Re-export commonly used filesystem utilities for backward compatibility
export { ensureDirectory, directoryExists, readJsonFile, writeJsonFile, fileExists, readTextFile, writeTextFile, } from "./filesystem.js";
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
//# sourceMappingURL=tenex.js.map