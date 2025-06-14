import type { Stats } from "node:fs";
import * as path from "node:path";
import type { IFileSystem } from "./FileSystem";

interface MockFile {
    content: string | Buffer;
    stats: Partial<Stats>;
}

interface MockFileSystemData {
    files: Map<string, MockFile>;
    directories: Set<string>;
}

/**
 * Mock file system implementation for testing
 */
export class MockFileSystem implements IFileSystem {
    private data: MockFileSystemData = {
        files: new Map(),
        directories: new Set(["/"]),
    };

    constructor(initialData?: { [path: string]: string | Buffer }) {
        if (initialData) {
            for (const [filePath, content] of Object.entries(initialData)) {
                this.writeFileSync(filePath, content);
            }
        }
    }

    // Helper methods for testing
    reset(): void {
        this.data = {
            files: new Map(),
            directories: new Set(["/"]),
        };
    }

    getFileContent(filePath: string): string | Buffer | undefined {
        const expandedPath = this.expandHome(filePath);
        return this.data.files.get(expandedPath)?.content;
    }

    getAllFiles(): string[] {
        return Array.from(this.data.files.keys());
    }

    getAllDirectories(): string[] {
        return Array.from(this.data.directories);
    }

    // Synchronous operations
    readFileSync(filePath: string, encoding?: BufferEncoding): string;
    readFileSync(filePath: string, options?: { encoding?: null; flag?: string }): Buffer;
    readFileSync(
        filePath: string,
        encodingOrOptions?: BufferEncoding | { encoding?: null; flag?: string }
    ): string | Buffer {
        const expandedPath = this.expandHome(filePath);
        const file = this.data.files.get(expandedPath);

        if (!file) {
            throw new Error(`ENOENT: no such file or directory, open '${expandedPath}'`);
        }

        if (typeof encodingOrOptions === "string") {
            return file.content.toString(encodingOrOptions);
        }

        return file.content;
    }

    writeFileSync(filePath: string, data: string | Buffer, encoding?: BufferEncoding): void {
        const expandedPath = this.expandHome(filePath);
        const dir = path.dirname(expandedPath);

        if (!this.data.directories.has(dir)) {
            throw new Error(`ENOENT: no such file or directory, open '${expandedPath}'`);
        }

        const content = typeof data === "string" && encoding ? Buffer.from(data, encoding) : data;
        this.data.files.set(expandedPath, {
            content,
            stats: {
                size: content.length,
                mtime: new Date(),
                ctime: new Date(),
                isFile: () => true,
                isDirectory: () => false,
                isBlockDevice: () => false,
                isCharacterDevice: () => false,
                isSymbolicLink: () => false,
                isFIFO: () => false,
                isSocket: () => false,
            },
        });
    }

    existsSync(filePath: string): boolean {
        const expandedPath = this.expandHome(filePath);
        return this.data.files.has(expandedPath) || this.data.directories.has(expandedPath);
    }

    mkdirSync(dirPath: string, options?: { recursive?: boolean }): void {
        const expandedPath = this.expandHome(dirPath);

        if (options?.recursive) {
            const parts = expandedPath.split(path.sep).filter(Boolean);
            let currentPath = expandedPath.startsWith("/") ? "/" : "";

            for (const part of parts) {
                currentPath = path.join(currentPath, part);
                this.data.directories.add(currentPath);
            }
        } else {
            const parent = path.dirname(expandedPath);
            if (!this.data.directories.has(parent)) {
                throw new Error(`ENOENT: no such file or directory, mkdir '${expandedPath}'`);
            }
            this.data.directories.add(expandedPath);
        }
    }

    readdirSync(dirPath: string): string[] {
        const expandedPath = this.expandHome(dirPath);

        if (!this.data.directories.has(expandedPath)) {
            throw new Error(`ENOENT: no such file or directory, scandir '${expandedPath}'`);
        }

        const entries = new Set<string>();

        // Add files
        for (const filePath of this.data.files.keys()) {
            if (path.dirname(filePath) === expandedPath) {
                entries.add(path.basename(filePath));
            }
        }

        // Add directories
        for (const dir of this.data.directories) {
            if (path.dirname(dir) === expandedPath && dir !== expandedPath) {
                entries.add(path.basename(dir));
            }
        }

        return Array.from(entries);
    }

    statSync(filePath: string): Stats {
        const expandedPath = this.expandHome(filePath);

        if (this.data.files.has(expandedPath)) {
            return this.data.files.get(expandedPath)?.stats as Stats;
        }

        if (this.data.directories.has(expandedPath)) {
            return {
                size: 0,
                mtime: new Date(),
                ctime: new Date(),
                isFile: () => false,
                isDirectory: () => true,
                isBlockDevice: () => false,
                isCharacterDevice: () => false,
                isSymbolicLink: () => false,
                isFIFO: () => false,
                isSocket: () => false,
            } as Stats;
        }

        throw new Error(`ENOENT: no such file or directory, stat '${expandedPath}'`);
    }

    unlinkSync(filePath: string): void {
        const expandedPath = this.expandHome(filePath);

        if (!this.data.files.has(expandedPath)) {
            throw new Error(`ENOENT: no such file or directory, unlink '${expandedPath}'`);
        }

        this.data.files.delete(expandedPath);
    }

    rmdirSync(dirPath: string, options?: { recursive?: boolean }): void {
        const expandedPath = this.expandHome(dirPath);

        if (!this.data.directories.has(expandedPath)) {
            throw new Error(`ENOENT: no such file or directory, rmdir '${expandedPath}'`);
        }

        if (options?.recursive) {
            // Remove all subdirectories and files
            const toRemove = new Set<string>();

            for (const dir of this.data.directories) {
                if (dir.startsWith(expandedPath)) {
                    toRemove.add(dir);
                }
            }

            for (const file of this.data.files.keys()) {
                if (file.startsWith(expandedPath)) {
                    this.data.files.delete(file);
                }
            }

            for (const dir of toRemove) {
                this.data.directories.delete(dir);
            }
        } else {
            // Check if directory is empty
            const hasContents =
                Array.from(this.data.files.keys()).some((f) => path.dirname(f) === expandedPath) ||
                Array.from(this.data.directories).some(
                    (d) => path.dirname(d) === expandedPath && d !== expandedPath
                );

            if (hasContents) {
                throw new Error(`ENOTEMPTY: directory not empty, rmdir '${expandedPath}'`);
            }

            this.data.directories.delete(expandedPath);
        }
    }

    copyFileSync(src: string, dest: string): void {
        const expandedSrc = this.expandHome(src);
        const expandedDest = this.expandHome(dest);

        const file = this.data.files.get(expandedSrc);
        if (!file) {
            throw new Error(
                `ENOENT: no such file or directory, copyfile '${expandedSrc}' -> '${expandedDest}'`
            );
        }

        this.writeFileSync(expandedDest, file.content);
    }

    renameSync(oldPath: string, newPath: string): void {
        const expandedOld = this.expandHome(oldPath);
        const expandedNew = this.expandHome(newPath);

        if (this.data.files.has(expandedOld)) {
            const file = this.data.files.get(expandedOld)!;
            this.data.files.delete(expandedOld);
            this.data.files.set(expandedNew, file);
        } else if (this.data.directories.has(expandedOld)) {
            // Rename directory and all its contents
            const toRename = new Map<string, string>();

            for (const dir of this.data.directories) {
                if (dir.startsWith(expandedOld)) {
                    const newDir = expandedNew + dir.slice(expandedOld.length);
                    toRename.set(dir, newDir);
                }
            }

            for (const [file, data] of this.data.files) {
                if (file.startsWith(expandedOld)) {
                    const newFile = expandedNew + file.slice(expandedOld.length);
                    this.data.files.delete(file);
                    this.data.files.set(newFile, data);
                }
            }

            for (const [oldDir, newDir] of toRename) {
                this.data.directories.delete(oldDir);
                this.data.directories.add(newDir);
            }
        } else {
            throw new Error(
                `ENOENT: no such file or directory, rename '${expandedOld}' -> '${expandedNew}'`
            );
        }
    }

    // Asynchronous operations (implemented as sync with Promise wrapper)
    async readFile(filePath: string, encoding?: BufferEncoding): Promise<string>;
    async readFile(filePath: string, options?: { encoding?: null; flag?: string }): Promise<Buffer>;
    async readFile(
        filePath: string,
        encodingOrOptions?: BufferEncoding | { encoding?: null; flag?: string }
    ): Promise<string | Buffer> {
        if (typeof encodingOrOptions === "string") {
            return this.readFileSync(filePath, encodingOrOptions);
        }
        if (encodingOrOptions) {
            return this.readFileSync(filePath, encodingOrOptions);
        }
        return this.readFileSync(filePath);
    }

    async writeFile(
        filePath: string,
        data: string | Buffer,
        encoding?: BufferEncoding
    ): Promise<void> {
        this.writeFileSync(filePath, data, encoding);
    }

    async exists(filePath: string): Promise<boolean> {
        return this.existsSync(filePath);
    }

    async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
        this.mkdirSync(dirPath, options);
    }

    async readdir(dirPath: string): Promise<string[]> {
        return this.readdirSync(dirPath);
    }

    async stat(filePath: string): Promise<Stats> {
        return this.statSync(filePath);
    }

    async unlink(filePath: string): Promise<void> {
        this.unlinkSync(filePath);
    }

    async rmdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
        this.rmdirSync(dirPath, options);
    }

    async copyFile(src: string, dest: string): Promise<void> {
        this.copyFileSync(src, dest);
    }

    async rename(oldPath: string, newPath: string): Promise<void> {
        this.renameSync(oldPath, newPath);
    }

    // Path utilities
    expandHome(filePath: string): string {
        if (filePath.startsWith("~")) {
            return path.join("/home/user", filePath.slice(1));
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
        this.ensureDirSync(dirPath);
    }

    ensureDirSync(dirPath: string): void {
        this.mkdirSync(dirPath, { recursive: true });
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
        return this.listFilesSync(dirPath, recursive);
    }

    listFilesSync(dirPath: string, recursive = false): string[] {
        const expandedPath = this.expandHome(dirPath);
        const files: string[] = [];

        const processDir = (dir: string): void => {
            const entries = this.readdirSync(dir);

            for (const entry of entries) {
                const fullPath = path.join(dir, entry);
                const stats = this.statSync(fullPath);

                if (stats.isDirectory() && recursive) {
                    processDir(fullPath);
                } else if (stats.isFile()) {
                    files.push(fullPath);
                }
            }
        };

        processDir(expandedPath);
        return files;
    }
}
