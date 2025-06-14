import type { ProjectMetadata } from "@tenex/types/projects";
export { ensureDirectory, directoryExists, readJsonFile, writeJsonFile, fileExists, readTextFile, writeTextFile, } from "./filesystem.js";
/**
 * Get paths for common .tenex files
 */
export declare function getTenexPaths(projectPath: string): {
    tenexDir: string;
    agentsJson: string;
    metadataJson: string;
    llmsJson: string;
    agentsDir: string;
    rulesDir: string;
    conversationsDir: string;
};
/**
 * Read project metadata from .tenex/metadata.json
 */
export declare function readProjectMetadata(projectPath: string): Promise<ProjectMetadata | null>;
/**
 * Write project metadata to .tenex/metadata.json
 */
export declare function writeProjectMetadata(projectPath: string, metadata: ProjectMetadata): Promise<void>;
/**
 * Get project name from metadata or path
 */
export declare function getProjectName(projectPath: string): Promise<string>;
/**
 * Check if a project has been initialized (has .tenex directory)
 */
export declare function isProjectInitialized(projectPath: string): Promise<boolean>;
/**
 * Initialize .tenex directory structure
 */
export declare function initializeTenexDirectory(projectPath: string): Promise<void>;
//# sourceMappingURL=tenex.d.ts.map