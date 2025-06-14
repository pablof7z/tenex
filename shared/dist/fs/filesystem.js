import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { logError } from "../logger.js";
import { getErrorMessage } from "@tenex/types/utils";
/**
 * Unified file system utilities combining patterns from CLI and shared packages
 * Provides both sync and async operations with consistent error handling
 */
// Path utilities
export function expandHome(filePath) {
    if (filePath.startsWith("~")) {
        return path.join(os.homedir(), filePath.slice(1));
    }
    return filePath;
}
export function resolvePath(filePath) {
    return path.resolve(expandHome(filePath));
}
// Directory operations
export async function ensureDirectory(dirPath) {
    try {
        await fsPromises.access(dirPath);
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
            await fsPromises.mkdir(dirPath, { recursive: true });
        }
        else {
            throw err;
        }
    }
}
export function ensureDirectorySync(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
export async function directoryExists(dirPath) {
    try {
        const stat = await fsPromises.stat(dirPath);
        return stat.isDirectory();
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
            return false;
        }
        throw err;
    }
}
export function directoryExistsSync(dirPath) {
    try {
        const stat = fs.statSync(dirPath);
        return stat.isDirectory();
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
            return false;
        }
        throw err;
    }
}
// File operations
export async function fileExists(filePath) {
    try {
        const stat = await fsPromises.stat(filePath);
        return stat.isFile();
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
            return false;
        }
        throw err;
    }
}
export function fileExistsSync(filePath) {
    try {
        const stat = fs.statSync(filePath);
        return stat.isFile();
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
            return false;
        }
        throw err;
    }
}
// JSON operations with error handling
export async function readJsonFile(filePath) {
    try {
        const content = await fsPromises.readFile(resolvePath(filePath), "utf-8");
        return JSON.parse(content);
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
            return null;
        }
        logError(`Failed to read JSON file ${filePath}: ${getErrorMessage(err)}`);
        throw err;
    }
}
export function readJsonFileSync(filePath) {
    try {
        const content = fs.readFileSync(resolvePath(filePath), "utf-8");
        return JSON.parse(content);
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
            return null;
        }
        logError(`Failed to read JSON file ${filePath}: ${getErrorMessage(err)}`);
        throw err;
    }
}
export async function writeJsonFile(filePath, data, options) {
    const resolvedPath = resolvePath(filePath);
    await ensureDirectory(path.dirname(resolvedPath));
    const spaces = options?.spaces ?? 2;
    await fsPromises.writeFile(resolvedPath, JSON.stringify(data, null, spaces));
}
export function writeJsonFileSync(filePath, data, options) {
    const resolvedPath = resolvePath(filePath);
    ensureDirectorySync(path.dirname(resolvedPath));
    const spaces = options?.spaces ?? 2;
    fs.writeFileSync(resolvedPath, JSON.stringify(data, null, spaces));
}
// Text file operations
export async function readTextFile(filePath) {
    try {
        return await fsPromises.readFile(resolvePath(filePath), "utf-8");
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
            return null;
        }
        logError(`Failed to read text file ${filePath}: ${getErrorMessage(err)}`);
        throw err;
    }
}
export function readTextFileSync(filePath) {
    try {
        return fs.readFileSync(resolvePath(filePath), "utf-8");
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
            return null;
        }
        logError(`Failed to read text file ${filePath}: ${getErrorMessage(err)}`);
        throw err;
    }
}
export async function writeTextFile(filePath, content) {
    const resolvedPath = resolvePath(filePath);
    await ensureDirectory(path.dirname(resolvedPath));
    await fsPromises.writeFile(resolvedPath, content, "utf-8");
}
export function writeTextFileSync(filePath, content) {
    const resolvedPath = resolvePath(filePath);
    ensureDirectorySync(path.dirname(resolvedPath));
    fs.writeFileSync(resolvedPath, content, "utf-8");
}
// Directory listing
export async function listDirectory(dirPath) {
    try {
        return await fsPromises.readdir(resolvePath(dirPath));
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
            return [];
        }
        throw err;
    }
}
export function listDirectorySync(dirPath) {
    try {
        return fs.readdirSync(resolvePath(dirPath));
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
            return [];
        }
        throw err;
    }
}
// File copying
export async function copyFile(src, dest) {
    const resolvedDest = resolvePath(dest);
    await ensureDirectory(path.dirname(resolvedDest));
    await fsPromises.copyFile(resolvePath(src), resolvedDest);
}
export function copyFileSync(src, dest) {
    const resolvedDest = resolvePath(dest);
    ensureDirectorySync(path.dirname(resolvedDest));
    fs.copyFileSync(resolvePath(src), resolvedDest);
}
// File deletion
export async function deleteFile(filePath) {
    try {
        await fsPromises.unlink(resolvePath(filePath));
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
            // File doesn't exist, that's fine
            return;
        }
        throw err;
    }
}
export function deleteFileSync(filePath) {
    try {
        fs.unlinkSync(resolvePath(filePath));
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
            // File doesn't exist, that's fine
            return;
        }
        throw err;
    }
}
// Directory deletion
export async function deleteDirectory(dirPath, options) {
    try {
        await fsPromises.rm(resolvePath(dirPath), { recursive: options?.recursive ?? true });
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
            // Directory doesn't exist, that's fine
            return;
        }
        throw err;
    }
}
export function deleteDirectorySync(dirPath, options) {
    try {
        fs.rmSync(resolvePath(dirPath), { recursive: options?.recursive ?? true });
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
            // Directory doesn't exist, that's fine
            return;
        }
        throw err;
    }
}
// File stats
export async function getFileStats(filePath) {
    try {
        return await fsPromises.stat(resolvePath(filePath));
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
            return null;
        }
        throw err;
    }
}
export function getFileStatsSync(filePath) {
    try {
        return fs.statSync(resolvePath(filePath));
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
            return null;
        }
        throw err;
    }
}
//# sourceMappingURL=filesystem.js.map