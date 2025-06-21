import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { InventoryService } from "../InventoryService";
import type { ProjectInventory, FileInventoryItem } from "@tenex/types/inventory";
import { configurationService } from "@tenex/shared/services";

// Mock the logger
const mockLogger = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
  debug: mock(() => {}),
};

// Override the logger module
require.cache[require.resolve("@tenex/shared")] = {
  exports: { logger: mockLogger },
  id: require.resolve("@tenex/shared"),
  filename: require.resolve("@tenex/shared"),
  loaded: true,
  parent: null,
  children: [],
  paths: [],
};

describe("InventoryService", () => {
  const mockProjectPath = "/test/project";
  let service: InventoryService;

  beforeEach(() => {
    service = new InventoryService(mockProjectPath);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("generateInventory", () => {
    it("should generate a complete inventory of the project", async () => {
      // Mock file system structure
      vi.mocked(fs.readdir).mockImplementation(async (path) => {
        if (path === mockProjectPath) {
          return [
            { name: "src", isDirectory: () => true, isFile: () => false },
            { name: "package.json", isDirectory: () => false, isFile: () => true },
            { name: "README.md", isDirectory: () => false, isFile: () => true },
            { name: ".git", isDirectory: () => true, isFile: () => false },
            { name: "node_modules", isDirectory: () => true, isFile: () => false },
          ] as any;
        }
        if (path.includes("src")) {
          return [
            { name: "index.ts", isDirectory: () => false, isFile: () => true },
            { name: "utils.ts", isDirectory: () => false, isFile: () => true },
          ] as any;
        }
        return [];
      });

      vi.mocked(fs.stat).mockResolvedValue({
        size: 1024,
        mtimeMs: Date.now(),
        isFile: () => true,
      } as any);

      vi.mocked(configurationService.loadConfiguration).mockResolvedValue({
        config: { description: "Test project" },
      } as any);

      const inventory = await service.generateInventory();

      expect(inventory).toBeDefined();
      expect(inventory.projectPath).toBe(mockProjectPath);
      expect(inventory.projectDescription).toBe("Test project");
      expect(inventory.files).toHaveLength(4); // Excluding .git and node_modules
      expect(inventory.technologies).toContain("Node.js");
      expect(inventory.technologies).toContain("TypeScript");
    });

    it("should exclude default patterns", async () => {
      vi.mocked(fs.readdir).mockImplementation(async () => [
        { name: "src", isDirectory: () => true, isFile: () => false },
        { name: ".git", isDirectory: () => true, isFile: () => false },
        { name: "node_modules", isDirectory: () => true, isFile: () => false },
        { name: "dist", isDirectory: () => true, isFile: () => false },
        { name: ".DS_Store", isDirectory: () => false, isFile: () => true },
      ] as any);

      vi.mocked(fs.stat).mockResolvedValue({
        size: 100,
        mtimeMs: Date.now(),
        isFile: () => true,
      } as any);

      const inventory = await service.generateInventory();

      expect(inventory.files).toHaveLength(0);
      expect(inventory.directories).toHaveLength(0);
    });
  });

  describe("updateInventory", () => {
    const mockExistingInventory: ProjectInventory = {
      projectPath: mockProjectPath,
      generatedAt: Date.now() - 1000,
      version: "1.0.0",
      projectDescription: "Test project",
      technologies: ["Node.js"],
      files: [
        {
          path: "src/index.ts",
          type: ".ts",
          description: "TypeScript file",
          size: 1000,
          lastModified: Date.now() - 2000,
        },
      ],
      directories: [],
      stats: {
        totalFiles: 1,
        totalDirectories: 0,
        totalSize: 1000,
        fileTypes: { ".ts": 1 },
      },
    };

    it("should update inventory for modified files", async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        `<!-- INVENTORY_DATA: ${JSON.stringify(mockExistingInventory)} -->`
      );

      vi.mocked(fs.stat).mockResolvedValue({
        size: 1500,
        mtimeMs: Date.now(),
        isFile: () => true,
      } as any);

      const result = await service.updateInventory(["src/index.ts"]);

      expect(result.modified).toContain("src/index.ts");
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.inventory.files[0].size).toBe(1500);
    });

    it("should add new files to inventory", async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        `<!-- INVENTORY_DATA: ${JSON.stringify(mockExistingInventory)} -->`
      );

      vi.mocked(fs.stat).mockResolvedValue({
        size: 500,
        mtimeMs: Date.now(),
        isFile: () => true,
      } as any);

      const result = await service.updateInventory(["src/new-file.ts"]);

      expect(result.added).toContain("src/new-file.ts");
      expect(result.inventory.files).toHaveLength(2);
      expect(result.inventory.stats.totalFiles).toBe(2);
    });

    it("should remove deleted files from inventory", async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        `<!-- INVENTORY_DATA: ${JSON.stringify(mockExistingInventory)} -->`
      );

      vi.mocked(fs.stat).mockRejectedValue(new Error("File not found"));

      const result = await service.updateInventory(["src/index.ts"]);

      expect(result.removed).toContain("src/index.ts");
      expect(result.inventory.files).toHaveLength(0);
      expect(result.inventory.stats.totalFiles).toBe(0);
    });

    it("should generate new inventory if none exists", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));

      // Mock for generateInventory
      vi.mocked(fs.readdir).mockResolvedValue([]);
      vi.mocked(configurationService.loadConfiguration).mockResolvedValue({
        config: { description: "Test" },
      } as any);

      const result = await service.updateInventory(["src/index.ts"]);

      expect(result.added).toEqual(result.inventory.files.map(f => f.path));
      expect(result.modified).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });
  });

  describe("loadInventory", () => {
    it("should load and parse existing inventory", async () => {
      const mockInventory: ProjectInventory = {
        projectPath: mockProjectPath,
        generatedAt: Date.now(),
        version: "1.0.0",
        projectDescription: "Test",
        technologies: ["Node.js"],
        files: [],
        directories: [],
        stats: {
          totalFiles: 0,
          totalDirectories: 0,
          totalSize: 0,
          fileTypes: {},
        },
      };

      vi.mocked(fs.readFile).mockResolvedValue(
        `# Project Inventory\n<!-- INVENTORY_DATA:\n${JSON.stringify(mockInventory, null, 2)}\n-->`
      );

      vi.mocked(configurationService.loadConfiguration).mockResolvedValue({
        config: {},
      } as any);

      const inventory = await service.loadInventory();

      expect(inventory).toEqual(mockInventory);
    });

    it("should return null if inventory file doesn't exist", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(configurationService.loadConfiguration).mockResolvedValue({
        config: {},
      } as any);

      const inventory = await service.loadInventory();

      expect(inventory).toBeNull();
    });

    it("should return null if inventory cannot be parsed", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("Invalid markdown content");
      vi.mocked(configurationService.loadConfiguration).mockResolvedValue({
        config: {},
      } as any);

      const inventory = await service.loadInventory();

      expect(inventory).toBeNull();
    });
  });

  describe("saveInventory", () => {
    it("should save inventory as markdown", async () => {
      const mockInventory: ProjectInventory = {
        projectPath: mockProjectPath,
        generatedAt: Date.now(),
        version: "1.0.0",
        projectDescription: "Test project",
        technologies: ["Node.js", "TypeScript"],
        files: [
          {
            path: "src/index.ts",
            type: ".ts",
            description: "Main entry point",
            size: 1024,
            lastModified: Date.now(),
            tags: ["api"],
          },
        ],
        directories: [
          {
            path: "src",
            description: "Source directory",
            fileCount: 1,
            subdirectories: [],
          },
        ],
        stats: {
          totalFiles: 1,
          totalDirectories: 1,
          totalSize: 1024,
          fileTypes: { ".ts": 1 },
        },
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(configurationService.loadConfiguration).mockResolvedValue({
        config: {},
      } as any);

      await service.saveInventory(mockInventory);

      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
      
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const markdown = writeCall[1] as string;
      
      expect(markdown).toContain("# Project Inventory");
      expect(markdown).toContain("Test project");
      expect(markdown).toContain("Node.js, TypeScript");
      expect(markdown).toContain("src/index.ts");
      expect(markdown).toContain("Main entry point");
      expect(markdown).toContain("INVENTORY_DATA:");
    });

    it("should use custom inventory path from config", async () => {
      vi.mocked(configurationService.loadConfiguration).mockResolvedValue({
        config: {
          paths: {
            inventory: "docs/INVENTORY.md",
          },
        },
      } as any);

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const mockInventory: ProjectInventory = {
        projectPath: mockProjectPath,
        generatedAt: Date.now(),
        version: "1.0.0",
        projectDescription: "Test",
        technologies: [],
        files: [],
        directories: [],
        stats: {
          totalFiles: 0,
          totalDirectories: 0,
          totalSize: 0,
          fileTypes: {},
        },
      };

      await service.saveInventory(mockInventory);

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      expect(writeCall[0]).toBe(path.join(mockProjectPath, ".tenex", "docs/INVENTORY.md"));
    });
  });

  describe("getDiff", () => {
    it("should correctly identify added, modified, and removed files", () => {
      const oldInventory: ProjectInventory = {
        projectPath: mockProjectPath,
        generatedAt: Date.now() - 1000,
        version: "1.0.0",
        projectDescription: "Test",
        technologies: [],
        files: [
          {
            path: "file1.ts",
            type: ".ts",
            description: "File 1",
            size: 100,
            lastModified: 1000,
          },
          {
            path: "file2.ts",
            type: ".ts",
            description: "File 2",
            size: 200,
            lastModified: 2000,
          },
        ],
        directories: [
          {
            path: "dir1",
            description: "Directory 1",
            fileCount: 1,
            subdirectories: [],
          },
        ],
        stats: {
          totalFiles: 2,
          totalDirectories: 1,
          totalSize: 300,
          fileTypes: { ".ts": 2 },
        },
      };

      const newInventory: ProjectInventory = {
        ...oldInventory,
        generatedAt: Date.now(),
        files: [
          {
            path: "file1.ts",
            type: ".ts",
            description: "File 1",
            size: 150, // Modified
            lastModified: 3000,
          },
          {
            path: "file3.ts", // Added
            type: ".ts",
            description: "File 3",
            size: 300,
            lastModified: 4000,
          },
        ],
        directories: [
          ...oldInventory.directories,
          {
            path: "dir2", // Added
            description: "Directory 2",
            fileCount: 1,
            subdirectories: [],
          },
        ],
      };

      const diff = service.getDiff(oldInventory, newInventory);

      expect(diff.added).toHaveLength(1);
      expect(diff.added[0].path).toBe("file3.ts");
      
      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].path).toBe("file1.ts");
      
      expect(diff.removed).toHaveLength(1);
      expect(diff.removed).toContain("file2.ts");
      
      expect(diff.directoriesAdded).toHaveLength(1);
      expect(diff.directoriesAdded[0].path).toBe("dir2");
      
      expect(diff.directoriesRemoved).toHaveLength(0);
    });
  });

  describe("technology detection", () => {
    it("should detect technologies from file names", async () => {
      vi.mocked(fs.readdir).mockImplementation(async (path) => {
        if (path === mockProjectPath) {
          return [
            { name: "package.json", isDirectory: () => false, isFile: () => true },
            { name: "tsconfig.json", isDirectory: () => false, isFile: () => true },
            { name: "vite.config.ts", isDirectory: () => false, isFile: () => true },
            { name: "jest.config.js", isDirectory: () => false, isFile: () => true },
            { name: "requirements.txt", isDirectory: () => false, isFile: () => true },
            { name: "go.mod", isDirectory: () => false, isFile: () => true },
          ] as any;
        }
        return [];
      });

      vi.mocked(fs.stat).mockResolvedValue({
        size: 100,
        mtimeMs: Date.now(),
        isFile: () => true,
      } as any);

      vi.mocked(configurationService.loadConfiguration).mockResolvedValue({
        config: {},
      } as any);

      const inventory = await service.generateInventory();

      expect(inventory.technologies).toContain("Node.js");
      expect(inventory.technologies).toContain("TypeScript");
      expect(inventory.technologies).toContain("Vite");
      expect(inventory.technologies).toContain("Jest");
      expect(inventory.technologies).toContain("Python");
      expect(inventory.technologies).toContain("Go");
    });
  });

  describe("file tagging", () => {
    it("should tag files based on their paths", async () => {
      vi.mocked(fs.readdir).mockImplementation(async (path) => {
        if (path === mockProjectPath) {
          return [
            { name: "test.spec.ts", isDirectory: () => false, isFile: () => true },
            { name: "UserService.ts", isDirectory: () => false, isFile: () => true },
            { name: "Button.component.tsx", isDirectory: () => false, isFile: () => true },
            { name: "utils.ts", isDirectory: () => false, isFile: () => true },
            { name: "config.json", isDirectory: () => false, isFile: () => true },
            { name: "schema.graphql", isDirectory: () => false, isFile: () => true },
            { name: "routes.ts", isDirectory: () => false, isFile: () => true },
          ] as any;
        }
        return [];
      });

      vi.mocked(fs.stat).mockResolvedValue({
        size: 100,
        mtimeMs: Date.now(),
        isFile: () => true,
      } as any);

      vi.mocked(configurationService.loadConfiguration).mockResolvedValue({
        config: {},
      } as any);

      const inventory = await service.generateInventory();

      const testFile = inventory.files.find(f => f.path === "test.spec.ts");
      expect(testFile?.tags).toContain("test");

      const serviceFile = inventory.files.find(f => f.path === "UserService.ts");
      expect(serviceFile?.tags).toContain("service");

      const componentFile = inventory.files.find(f => f.path === "Button.component.tsx");
      expect(componentFile?.tags).toContain("component");

      const utilFile = inventory.files.find(f => f.path === "utils.ts");
      expect(utilFile?.tags).toContain("utility");

      const configFile = inventory.files.find(f => f.path === "config.json");
      expect(configFile?.tags).toContain("configuration");

      const schemaFile = inventory.files.find(f => f.path === "schema.graphql");
      expect(schemaFile?.tags).toContain("schema");

      const routesFile = inventory.files.find(f => f.path === "routes.ts");
      expect(routesFile?.tags).toContain("api");
    });
  });
});