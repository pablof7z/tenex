/**
 * Project inventory types for TENEX
 */

export interface FileInventoryItem {
  /** Relative path from project root */
  path: string;
  /** File type/extension */
  type: string;
  /** One-line description of the file's purpose */
  description: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp */
  lastModified: number;
  /** Key exports or functionality (optional) */
  exports?: string[];
  /** Dependencies this file imports (optional) */
  imports?: string[];
  /** Tags for categorization (e.g., "service", "component", "util") */
  tags?: string[];
}

export interface DirectoryInventoryItem {
  /** Relative path from project root */
  path: string;
  /** One-line description of the directory's purpose */
  description: string;
  /** Number of files in this directory (non-recursive) */
  fileCount: number;
  /** Subdirectories */
  subdirectories: string[];
}

export interface ProjectInventory {
  /** Project root path */
  projectPath: string;
  /** Timestamp when inventory was generated */
  generatedAt: number;
  /** Version of the inventory format */
  version: string;
  /** Overall project description */
  projectDescription: string;
  /** Key technologies detected */
  technologies: string[];
  /** File inventory */
  files: FileInventoryItem[];
  /** Directory inventory */
  directories: DirectoryInventoryItem[];
  /** Summary statistics */
  stats: {
    totalFiles: number;
    totalDirectories: number;
    totalSize: number;
    fileTypes: Record<string, number>;
  };
}

export interface InventoryConfig {
  /** Path to store inventory file (relative to project root) */
  inventoryPath?: string;
  /** Patterns to exclude from inventory */
  exclude?: string[];
  /** Maximum file size to analyze content (in bytes) */
  maxFileSize?: number;
  /** Whether to analyze file exports/imports */
  analyzeExports?: boolean;
}

export interface InventoryUpdateResult {
  /** Files that were added */
  added: string[];
  /** Files that were modified */
  modified: string[];
  /** Files that were removed */
  removed: string[];
  /** New inventory after update */
  inventory: ProjectInventory;
}

export interface InventoryAnalysisRequest {
  /** Project path to analyze */
  projectPath: string;
  /** Optional configuration */
  config?: InventoryConfig;
  /** Files to focus on (if doing partial update) */
  targetFiles?: string[];
}

export interface InventoryDiff {
  /** Files added since last inventory */
  added: FileInventoryItem[];
  /** Files modified since last inventory */
  modified: FileInventoryItem[];
  /** Files removed since last inventory */
  removed: string[];
  /** Directories added */
  directoriesAdded: DirectoryInventoryItem[];
  /** Directories removed */
  directoriesRemoved: string[];
}