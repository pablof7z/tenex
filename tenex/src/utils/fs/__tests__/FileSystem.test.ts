import { beforeEach, describe, expect, it } from "bun:test";
import type { IFileSystem } from "../FileSystem";
import { MockFileSystem } from "../MockFileSystem";

describe("FileSystem", () => {
    let fs: MockFileSystem;

    beforeEach(() => {
        fs = new MockFileSystem();
    });

    describe("Basic Operations", () => {
        it("should write and read files", async () => {
            await fs.writeFile("/test.txt", "Hello, World!");
            const content = await fs.readFile("/test.txt", "utf8");
            expect(content).toBe("Hello, World!");
        });

        it("should handle binary data", async () => {
            const buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
            await fs.writeFile("/binary.dat", buffer);
            const read = await fs.readFile("/binary.dat");
            expect(read).toEqual(buffer);
        });

        it("should check file existence", async () => {
            expect(await fs.exists("/test.txt")).toBe(false);
            await fs.writeFile("/test.txt", "content");
            expect(await fs.exists("/test.txt")).toBe(true);
        });

        it("should delete files", async () => {
            await fs.writeFile("/test.txt", "content");
            await fs.unlink("/test.txt");
            expect(await fs.exists("/test.txt")).toBe(false);
        });

        it("should throw on reading non-existent file", async () => {
            await expect(fs.readFile("/missing.txt")).rejects.toThrow("ENOENT");
        });
    });

    describe("Directory Operations", () => {
        it("should create directories", async () => {
            await fs.mkdir("/test-dir");
            expect(await fs.exists("/test-dir")).toBe(true);
        });

        it("should create nested directories", async () => {
            await fs.mkdir("/a/b/c", { recursive: true });
            expect(await fs.exists("/a/b/c")).toBe(true);
        });

        it("should list directory contents", async () => {
            await fs.mkdir("/dir");
            await fs.writeFile("/dir/file1.txt", "content1");
            await fs.writeFile("/dir/file2.txt", "content2");
            await fs.mkdir("/dir/subdir");

            const contents = await fs.readdir("/dir");
            expect(contents).toContain("file1.txt");
            expect(contents).toContain("file2.txt");
            expect(contents).toContain("subdir");
        });

        it("should remove empty directories", async () => {
            await fs.mkdir("/empty-dir");
            await fs.rmdir("/empty-dir");
            expect(await fs.exists("/empty-dir")).toBe(false);
        });

        it("should remove directories recursively", async () => {
            await fs.mkdir("/dir/subdir", { recursive: true });
            await fs.writeFile("/dir/file.txt", "content");
            await fs.writeFile("/dir/subdir/nested.txt", "nested");

            await fs.rmdir("/dir", { recursive: true });
            expect(await fs.exists("/dir")).toBe(false);
        });
    });

    describe("JSON Operations", () => {
        it("should write and read JSON", async () => {
            const data = { name: "test", value: 42, nested: { foo: "bar" } };
            await fs.writeJSON("/data.json", data);
            const read = await fs.readJSON("/data.json");
            expect(read).toEqual(data);
        });

        it("should format JSON with spaces", async () => {
            await fs.writeJSON("/pretty.json", { foo: "bar" }, 4);
            const content = await fs.readFile("/pretty.json", "utf8");
            expect(content).toBe('{\n    "foo": "bar"\n}');
        });

        it("should throw on invalid JSON", async () => {
            await fs.writeFile("/invalid.json", "not json");
            await expect(fs.readJSON("/invalid.json")).rejects.toThrow();
        });
    });

    describe("Path Operations", () => {
        it("should expand home directory", () => {
            expect(fs.expandHome("~/test")).toBe("/home/user/test");
            expect(fs.expandHome("/absolute/path")).toBe("/absolute/path");
        });

        it("should handle path operations", () => {
            expect(fs.join("a", "b", "c")).toBe("a/b/c");
            expect(fs.dirname("/path/to/file.txt")).toBe("/path/to");
            expect(fs.basename("/path/to/file.txt")).toBe("file.txt");
            expect(fs.extname("/path/to/file.txt")).toBe(".txt");
        });

        it("should resolve paths", () => {
            const resolved = fs.resolvePath("relative", "path");
            expect(fs.isAbsolute(resolved)).toBe(true);
        });
    });

    describe("File Operations", () => {
        it("should copy files", async () => {
            await fs.writeFile("/source.txt", "content");
            await fs.copyFile("/source.txt", "/dest.txt");

            const dest = await fs.readFile("/dest.txt", "utf8");
            expect(dest).toBe("content");
        });

        it("should rename files", async () => {
            await fs.writeFile("/old.txt", "content");
            await fs.rename("/old.txt", "/new.txt");

            expect(await fs.exists("/old.txt")).toBe(false);
            expect(await fs.exists("/new.txt")).toBe(true);
            expect(await fs.readFile("/new.txt", "utf8")).toBe("content");
        });

        it("should get file stats", async () => {
            await fs.writeFile("/test.txt", "Hello, World!");
            const stats = await fs.stat("/test.txt");

            expect(stats.isFile()).toBe(true);
            expect(stats.isDirectory()).toBe(false);
            expect(stats.size).toBe(13);
        });
    });

    describe("High-level Utilities", () => {
        it("should ensure directory exists", async () => {
            await fs.ensureDir("/a/b/c");
            expect(await fs.exists("/a/b/c")).toBe(true);
        });

        it("should list files recursively", async () => {
            await fs.mkdir("/root/a", { recursive: true });
            await fs.mkdir("/root/b", { recursive: true });
            await fs.writeFile("/root/file1.txt", "content");
            await fs.writeFile("/root/a/file2.txt", "content");
            await fs.writeFile("/root/b/file3.txt", "content");

            const files = await fs.listFiles("/root", true);
            expect(files).toHaveLength(3);
            expect(files).toContain("/root/file1.txt");
            expect(files).toContain("/root/a/file2.txt");
            expect(files).toContain("/root/b/file3.txt");
        });

        it("should list files non-recursively", async () => {
            await fs.mkdir("/root/subdir", { recursive: true });
            await fs.writeFile("/root/file1.txt", "content");
            await fs.writeFile("/root/file2.txt", "content");
            await fs.writeFile("/root/subdir/nested.txt", "content");

            const files = await fs.listFiles("/root", false);
            expect(files).toHaveLength(2);
            expect(files).toContain("/root/file1.txt");
            expect(files).toContain("/root/file2.txt");
        });
    });

    describe("Mock-specific Features", () => {
        it("should track all files", async () => {
            await fs.writeFile("/a.txt", "a");
            await fs.writeFile("/b.txt", "b");
            await fs.mkdir("/dir");
            await fs.writeFile("/dir/c.txt", "c");

            const allFiles = fs.getAllFiles();
            expect(allFiles).toHaveLength(3);
            expect(allFiles).toContain("/a.txt");
            expect(allFiles).toContain("/b.txt");
            expect(allFiles).toContain("/dir/c.txt");
        });

        it("should track all directories", async () => {
            await fs.mkdir("/a/b/c", { recursive: true });

            const allDirs = fs.getAllDirectories();
            expect(allDirs).toContain("/");
            expect(allDirs).toContain("/a");
            expect(allDirs).toContain("/a/b");
            expect(allDirs).toContain("/a/b/c");
        });

        it("should reset state", async () => {
            await fs.writeFile("/test.txt", "content");
            expect(await fs.exists("/test.txt")).toBe(true);

            fs.reset();
            expect(await fs.exists("/test.txt")).toBe(false);
        });

        it("should initialize with data", () => {
            const fsWithData = new MockFileSystem({
                "/config.json": '{"version": "1.0.0"}',
                "/data.txt": "Hello, World!",
            });

            expect(fsWithData.existsSync("/config.json")).toBe(true);
            expect(fsWithData.existsSync("/data.txt")).toBe(true);
            expect(fsWithData.readFileSync("/data.txt", "utf8")).toBe("Hello, World!");
        });
    });
});
