import path from "node:path";
import type { TenexConfig } from "@/types/config";
import { directoryExists, ensureDirectory, readJsonFile, writeJsonFile } from "./filesystem.js";

/**
 * Get paths for common .tenex files
 */
export function getTenexPaths(projectPath: string) {
    const tenexDir = path.join(projectPath, ".tenex");
    return {
        tenexDir,
        agentsJson: path.join(tenexDir, "agents.json"),
        configJson: path.join(tenexDir, "config.json"),
        llmsJson: path.join(tenexDir, "llms.json"),
        agentsDir: path.join(tenexDir, "agents"),
        rulesDir: path.join(tenexDir, "rules"),
        conversationsDir: path.join(tenexDir, "conversations"),
    };
}

/**
 * Read project config from .tenex/config.json
 */
export async function readProjectConfig(projectPath: string): Promise<TenexConfig | null> {
    const paths = getTenexPaths(projectPath);
    return readJsonFile<TenexConfig>(paths.configJson);
}

/**
 * Write project config to .tenex/config.json
 */
export async function writeProjectConfig(
    projectPath: string,
    config: TenexConfig
): Promise<void> {
    const paths = getTenexPaths(projectPath);
    await writeJsonFile(paths.configJson, config);
}

/**
 * Get project name from config or path
 */
export async function getProjectName(projectPath: string): Promise<string> {
    const config = await readProjectConfig(projectPath);
    if (config) {
        return config.title || path.basename(projectPath);
    }
    return path.basename(projectPath);
}

/**
 * Check if a project has been initialized (has .tenex directory)
 */
export async function isProjectInitialized(projectPath: string): Promise<boolean> {
    const paths = getTenexPaths(projectPath);
    return directoryExists(paths.tenexDir);
}

/**
 * Initialize .tenex directory structure
 */
export async function initializeTenexDirectory(projectPath: string): Promise<void> {
    const paths = getTenexPaths(projectPath);

    // Create main .tenex directory
    await ensureDirectory(paths.tenexDir);

    // Create subdirectories
    await ensureDirectory(paths.agentsDir);
    await ensureDirectory(paths.rulesDir);
    await ensureDirectory(paths.conversationsDir);
}
