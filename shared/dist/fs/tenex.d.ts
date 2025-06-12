import type { ProjectMetadata } from "../types/index.js";
/**
 * Ensure a directory exists, creating it if necessary
 */
export declare function ensureDirectory(dirPath: string): Promise<void>;
/**
 * Check if a directory exists
 */
export declare function directoryExists(dirPath: string): Promise<boolean>;
/**
 * Read JSON file with error handling
 */
export declare function readJsonFile<T>(filePath: string): Promise<T | null>;
/**
 * Write JSON file with pretty printing
 */
export declare function writeJsonFile<T>(filePath: string, data: T): Promise<void>;
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
