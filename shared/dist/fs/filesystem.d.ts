import type { Stats } from "node:fs";
/**
 * Unified file system utilities combining patterns from CLI and shared packages
 * Provides both sync and async operations with consistent error handling
 */
export declare function expandHome(filePath: string): string;
export declare function resolvePath(filePath: string): string;
export declare function ensureDirectory(dirPath: string): Promise<void>;
export declare function ensureDirectorySync(dirPath: string): void;
export declare function directoryExists(dirPath: string): Promise<boolean>;
export declare function directoryExistsSync(dirPath: string): boolean;
export declare function fileExists(filePath: string): Promise<boolean>;
export declare function fileExistsSync(filePath: string): boolean;
export declare function readJsonFile<T>(filePath: string): Promise<T | null>;
export declare function readJsonFileSync<T>(filePath: string): T | null;
export declare function writeJsonFile<T>(filePath: string, data: T, options?: {
    spaces?: number;
}): Promise<void>;
export declare function writeJsonFileSync<T>(filePath: string, data: T, options?: {
    spaces?: number;
}): void;
export declare function readTextFile(filePath: string): Promise<string | null>;
export declare function readTextFileSync(filePath: string): string | null;
export declare function writeTextFile(filePath: string, content: string): Promise<void>;
export declare function writeTextFileSync(filePath: string, content: string): void;
export declare function listDirectory(dirPath: string): Promise<string[]>;
export declare function listDirectorySync(dirPath: string): string[];
export declare function copyFile(src: string, dest: string): Promise<void>;
export declare function copyFileSync(src: string, dest: string): void;
export declare function deleteFile(filePath: string): Promise<void>;
export declare function deleteFileSync(filePath: string): void;
export declare function deleteDirectory(dirPath: string, options?: {
    recursive?: boolean;
}): Promise<void>;
export declare function deleteDirectorySync(dirPath: string, options?: {
    recursive?: boolean;
}): void;
export declare function getFileStats(filePath: string): Promise<Stats | null>;
export declare function getFileStatsSync(filePath: string): Stats | null;
//# sourceMappingURL=filesystem.d.ts.map