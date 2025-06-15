import * as fs from "node:fs";
import type { Stats } from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

/**
 * File system abstraction interface
 * Provides a testable interface for all file system operations
 */
export interface IFileSystem {
    // Synchronous operations
    readFileSync(filePath: string, encoding?: BufferEncoding): string;
    readFileSync(filePath: string, options?: { encoding?: null; flag?: string }): Buffer;
    writeFileSync(filePath: string, data: string | Buffer, encoding?: BufferEncoding): void;
    existsSync(filePath: string): boolean;
    mkdirSync(dirPath: string, options?: { recursive?: boolean }): void;
    readdirSync(dirPath: string): string[];
    statSync(filePath: string): Stats;
    unlinkSync(filePath: string): void;
    rmdirSync(dirPath: string, options?: { recursive?: boolean }): void;
    copyFileSync(src: string, dest: string): void;
    renameSync(oldPath: string, newPath: string): void;

    // Asynchronous operations
    readFile(filePath: string, encoding?: BufferEncoding): Promise<string>;
    readFile(filePath: string, options?: { encoding?: null; flag?: string }): Promise<Buffer>;
    writeFile(filePath: string, data: string | Buffer, encoding?: BufferEncoding): Promise<void>;
    exists(filePath: string): Promise<boolean>;
    access(filePath: string, mode?: number): Promise<void>;
    mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void>;
    readdir(dirPath: string): Promise<string[]>;
    stat(filePath: string): Promise<Stats>;
    unlink(filePath: string): Promise<void>;
    rmdir(dirPath: string, options?: { recursive?: boolean }): Promise<void>;
    copyFile(src: string, dest: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;

    // Path utilities
    expandHome(filePath: string): string;
    resolvePath(...pathSegments: string[]): string;
    dirname(filePath: string): string;
    basename(filePath: string, ext?: string): string;
    extname(filePath: string): string;
    join(...paths: string[]): string;
    isAbsolute(filePath: string): boolean;
    relative(from: string, to: string): string;

    // High-level utilities
    ensureDir(dirPath: string): Promise<void>;
    ensureDirSync(dirPath: string): void;
    readJSON<T = unknown>(filePath: string): Promise<T>;
    readJSONSync<T = unknown>(filePath: string): T;
    writeJSON<T = unknown>(filePath: string, data: T, spaces?: number): Promise<void>;
    writeJSONSync<T = unknown>(filePath: string, data: T, spaces?: number): void;
    listFiles(dirPath: string, recursive?: boolean): Promise<string[]>;
    listFilesSync(dirPath: string, recursive?: boolean): string[];
}

/**
 * Real file system implementation
 */
export class FileSystem implements IFileSystem {
    // Synchronous operations
    readFileSync(filePath: string, encoding?: BufferEncoding): string;
    readFileSync(filePath: string, options?: { encoding?: null; flag?: string }): Buffer;
    readFileSync(
        filePath: string,
        encodingOrOptions?: BufferEncoding | { encoding?: null; flag?: string }
    ): string | Buffer {
        const expandedPath = this.expandHome(filePath);
        if (typeof encodingOrOptions === "string") {
            return fs.readFileSync(expandedPath, encodingOrOptions);
        }
        return fs.readFileSync(expandedPath, encodingOrOptions);
    }

    writeFileSync(filePath: string, data: string | Buffer, encoding?: BufferEncoding): void {
        const expandedPath = this.expandHome(filePath);
        this.ensureDirSync(path.dirname(expandedPath));
        fs.writeFileSync(expandedPath, data, encoding);
    }

    existsSync(filePath: string): boolean {
        const expandedPath = this.expandHome(filePath);
        return fs.existsSync(expandedPath);
    }

    mkdirSync(dirPath: string, options?: { recursive?: boolean }): void {
        const expandedPath = this.expandHome(dirPath);
        fs.mkdirSync(expandedPath, options);
    }

    readdirSync(dirPath: string): string[] {
        const expandedPath = this.expandHome(dirPath);
        return fs.readdirSync(expandedPath);
    }

    statSync(filePath: string): Stats {
        const expandedPath = this.expandHome(filePath);
        return fs.statSync(expandedPath);
    }

    unlinkSync(filePath: string): void {
        const expandedPath = this.expandHome(filePath);
        fs.unlinkSync(expandedPath);
    }

    rmdirSync(dirPath: string, options?: { recursive?: boolean }): void {
        const expandedPath = this.expandHome(dirPath);
        fs.rmSync(expandedPath, { recursive: options?.recursive, force: true });
    }

    copyFileSync(src: string, dest: string): void {
        const expandedSrc = this.expandHome(src);
        const expandedDest = this.expandHome(dest);
        this.ensureDirSync(path.dirname(expandedDest));
        fs.copyFileSync(expandedSrc, expandedDest);
    }

    renameSync(oldPath: string, newPath: string): void {
        const expandedOld = this.expandHome(oldPath);
        const expandedNew = this.expandHome(newPath);
        this.ensureDirSync(path.dirname(expandedNew));
        fs.renameSync(expandedOld, expandedNew);
    }

    // Asynchronous operations
    async readFile(filePath: string, encoding?: BufferEncoding): Promise<string>;
    async readFile(filePath: string, options?: { encoding?: null; flag?: string }): Promise<Buffer>;
    async readFile(
        filePath: string,
        encodingOrOptions?: BufferEncoding | { encoding?: null; flag?: string }
    ): Promise<string | Buffer> {
        const expandedPath = this.expandHome(filePath);
        if (typeof encodingOrOptions === "string") {
            return await fsPromises.readFile(expandedPath, encodingOrOptions);
        }
        return await fsPromises.readFile(expandedPath, encodingOrOptions);
    }

    async writeFile(
        filePath: string,
        data: string | Buffer,
        encoding?: BufferEncoding
    ): Promise<void> {
        const expandedPath = this.expandHome(filePath);
        await this.ensureDir(path.dirname(expandedPath));
        await fsPromises.writeFile(expandedPath, data, encoding);
    }

    async exists(filePath: string): Promise<boolean> {
        const expandedPath = this.expandHome(filePath);
        try {
            await fsPromises.access(expandedPath);
            return true;
        } catch {
            return false;
        }
    }

    async access(filePath: string, mode?: number): Promise<void> {
        const expandedPath = this.expandHome(filePath);
        await fsPromises.access(expandedPath, mode);
    }

    async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
        const expandedPath = this.expandHome(dirPath);
        await fsPromises.mkdir(expandedPath, options);
    }

    async readdir(dirPath: string): Promise<string[]> {
        const expandedPath = this.expandHome(dirPath);
        return await fsPromises.readdir(expandedPath);
    }

    async stat(filePath: string): Promise<Stats> {
        const expandedPath = this.expandHome(filePath);
        return await fsPromises.stat(expandedPath);
    }

    async unlink(filePath: string): Promise<void> {
        const expandedPath = this.expandHome(filePath);
        await fsPromises.unlink(expandedPath);
    }

    async rmdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
        const expandedPath = this.expandHome(dirPath);
        await fsPromises.rm(expandedPath, {
            recursive: options?.recursive,
            force: true,
        });
    }

    async copyFile(src: string, dest: string): Promise<void> {
        const expandedSrc = this.expandHome(src);
        const expandedDest = this.expandHome(dest);
        await this.ensureDir(path.dirname(expandedDest));
        await fsPromises.copyFile(expandedSrc, expandedDest);
    }

    async rename(oldPath: string, newPath: string): Promise<void> {
        const expandedOld = this.expandHome(oldPath);
        const expandedNew = this.expandHome(newPath);
        await this.ensureDir(path.dirname(expandedNew));
        await fsPromises.rename(expandedOld, expandedNew);
    }

    // Path utilities
    expandHome(filePath: string): string {
        if (filePath.startsWith("~")) {
            return path.join(os.homedir(), filePath.slice(1));
        }
        return filePath;
    }

    resolvePath(...pathSegments: string[]): string {
        const expanded = pathSegments.map((seg) => this.expandHome(seg));
        return path.resolve(...expanded);
    }

    dirname(filePath: string): string {
        return path.dirname(filePath);
    }

    basename(filePath: string, ext?: string): string {
        return path.basename(filePath, ext);
    }

    extname(filePath: string): string {
        return path.extname(filePath);
    }

    join(...paths: string[]): string {
        return path.join(...paths);
    }

    isAbsolute(filePath: string): boolean {
        return path.isAbsolute(filePath);
    }

    relative(from: string, to: string): string {
        return path.relative(from, to);
    }

    // High-level utilities
    async ensureDir(dirPath: string): Promise<void> {
        const expandedPath = this.expandHome(dirPath);
        await fsPromises.mkdir(expandedPath, { recursive: true });
    }

    ensureDirSync(dirPath: string): void {
        const expandedPath = this.expandHome(dirPath);
        fs.mkdirSync(expandedPath, { recursive: true });
    }

    async readJSON<T = unknown>(filePath: string): Promise<T> {
        const content = await this.readFile(filePath, "utf8");
        return JSON.parse(content) as T;
    }

    readJSONSync<T = unknown>(filePath: string): T {
        const content = this.readFileSync(filePath, "utf8");
        return JSON.parse(content) as T;
    }

    async writeJSON<T = unknown>(filePath: string, data: T, spaces = 2): Promise<void> {
        const content = JSON.stringify(data, null, spaces);
        await this.writeFile(filePath, content, "utf8");
    }

    writeJSONSync<T = unknown>(filePath: string, data: T, spaces = 2): void {
        const content = JSON.stringify(data, null, spaces);
        this.writeFileSync(filePath, content, "utf8");
    }

    async listFiles(dirPath: string, recursive = false): Promise<string[]> {
        const expandedPath = this.expandHome(dirPath);
        const files: string[] = [];

        const processDir = async (dir: string): Promise<void> => {
            const entries = await fsPromises.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory() && recursive) {
                    await processDir(fullPath);
                } else if (entry.isFile()) {
                    files.push(fullPath);
                }
            }
        };

        await processDir(expandedPath);
        return files;
    }

    listFilesSync(dirPath: string, recursive = false): string[] {
        const expandedPath = this.expandHome(dirPath);
        const files: string[] = [];

        const processDir = (dir: string): void => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory() && recursive) {
                    processDir(fullPath);
                } else if (entry.isFile()) {
                    files.push(fullPath);
                }
            }
        };

        processDir(expandedPath);
        return files;
    }
}

// Default instance
export const fileSystem = new FileSystem();
