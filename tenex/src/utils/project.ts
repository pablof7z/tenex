import { join } from "node:path";
import { logger } from "@/utils/logger";
import { readdir, stat } from "node:fs/promises";

export interface ProjectFile {
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size?: number;
}

export interface ProjectContext {
  files: ProjectFile[];
  totalFiles: number;
  directories: string[];
  fileTypes: Record<string, number>;
}

/**
 * Get project context including file structure and metadata
 */
export async function getProjectContext(projectPath: string): Promise<ProjectContext> {
  try {
    const files = await getProjectFiles(projectPath);
    const directories = files.filter((f) => f.isDirectory).map((f) => f.relativePath);
    const fileTypes = getFileTypeStats(files.filter((f) => !f.isDirectory));

    return {
      files,
      totalFiles: files.filter((f) => !f.isDirectory).length,
      directories,
      fileTypes,
    };
  } catch (error) {
    logger.error("Failed to get project context", { error, projectPath });
    return {
      files: [],
      totalFiles: 0,
      directories: [],
      fileTypes: {},
    };
  }
}

/**
 * Recursively get all files in a project directory
 */
async function getProjectFiles(dirPath: string, baseDir?: string): Promise<ProjectFile[]> {
  const actualBaseDir = baseDir || dirPath;
  const files: ProjectFile[] = [];

  try {
    const entries = await readdir(dirPath);

    for (const entry of entries) {
      // Skip common directories that don't need to be included in routing context
      if (shouldSkipPath(entry)) {
        continue;
      }

      const fullPath = join(dirPath, entry);
      const relativePath = fullPath.replace(`${actualBaseDir}/`, "");

      try {
        const stats = await stat(fullPath);

        files.push({
          path: fullPath,
          relativePath,
          isDirectory: stats.isDirectory(),
          size: stats.isDirectory() ? undefined : stats.size,
        });

        // Recursively get files from subdirectories
        if (stats.isDirectory()) {
          const subFiles = await getProjectFiles(fullPath, actualBaseDir);
          files.push(...subFiles);
        }
      } catch (error) {
        logger.warn("Failed to stat file", { path: fullPath, error });
      }
    }
  } catch (error) {
    logger.warn("Failed to read directory", { path: dirPath, error });
  }

  return files;
}

/**
 * Check if a path should be skipped during project scanning
 */
function shouldSkipPath(path: string): boolean {
  const skipPatterns = [
    "node_modules",
    ".git",
    ".tenex",
    "dist",
    "build",
    ".next",
    "coverage",
    ".nyc_output",
    "tmp",
    "temp",
    ".DS_Store",
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb",
  ];

  return skipPatterns.some((pattern) => path.includes(pattern));
}

/**
 * Get statistics about file types in the project
 */
function getFileTypeStats(files: ProjectFile[]): Record<string, number> {
  const stats: Record<string, number> = {};

  for (const file of files) {
    const extension = getFileExtension(file.relativePath);
    stats[extension] = (stats[extension] || 0) + 1;
  }

  return stats;
}

/**
 * Get file extension from path
 */
function getFileExtension(path: string): string {
  const lastDot = path.lastIndexOf(".");
  if (lastDot === -1) return "no-extension";
  return path.substring(lastDot + 1).toLowerCase();
}

/**
 * Format project context for routing LLM prompt
 */
export function formatProjectContextForPrompt(context: ProjectContext): string {
  const { files, totalFiles, directories, fileTypes } = context;

  // Group files by directory for better organization
  const filesByDir: Record<string, string[]> = {};

  for (const file of files.filter((f) => !f.isDirectory)) {
    const dir = file.relativePath.includes("/")
      ? file.relativePath.substring(0, file.relativePath.lastIndexOf("/"))
      : ".";

    if (!filesByDir[dir]) {
      filesByDir[dir] = [];
    }
    filesByDir[dir].push(file.relativePath);
  }

  let output = `## Project Structure (${totalFiles} files)\n\n`;

  // Add file type summary
  output += "### File Types:\n";
  const sortedTypes = Object.entries(fileTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Top 10 file types

  for (const [type, count] of sortedTypes) {
    output += `- ${type}: ${count} files\n`;
  }

  output += "\n### Directory Structure:\n";

  // Sort directories by depth and name
  const sortedDirs = Object.keys(filesByDir).sort((a, b) => {
    const aDepth = a.split("/").length;
    const bDepth = b.split("/").length;
    if (aDepth !== bDepth) return aDepth - bDepth;
    return a.localeCompare(b);
  });

  for (const dir of sortedDirs.slice(0, 20)) {
    // Limit to top 20 directories
    output += `\n**${dir}/**\n`;
    const dirFiles = filesByDir[dir];
    if (dirFiles) {
      const limitedFiles = dirFiles.slice(0, 15); // Limit files per directory
      for (const file of limitedFiles) {
        const fileName = file.includes("/") ? file.substring(file.lastIndexOf("/") + 1) : file;
        output += `  - ${fileName}\n`;
      }
      if (dirFiles.length > 15) {
        output += `  - ... and ${dirFiles.length - 15} more files\n`;
      }
    }
  }

  if (sortedDirs.length > 20) {
    output += `\n... and ${sortedDirs.length - 20} more directories\n`;
  }

  return output;
}
