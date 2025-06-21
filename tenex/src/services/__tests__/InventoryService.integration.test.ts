import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { InventoryService } from "../InventoryService";
import type { ProjectInventory } from "@tenex/types/inventory";

describe("InventoryService Integration Tests", () => {
  let tempDir: string;
  let service: InventoryService;

  beforeEach(async () => {
    // Create a temporary test directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tenex-inventory-test-"));
    
    // Create test project structure
    await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
    await fs.mkdir(path.join(tempDir, "test"), { recursive: true });
    await fs.mkdir(path.join(tempDir, ".tenex"), { recursive: true });
    
    // Create test files
    await fs.writeFile(path.join(tempDir, "package.json"), JSON.stringify({
      name: "test-project",
      version: "1.0.0",
      dependencies: {
        "typescript": "^5.0.0"
      }
    }));
    
    await fs.writeFile(path.join(tempDir, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        target: "es2020",
        module: "commonjs"
      }
    }));
    
    await fs.writeFile(path.join(tempDir, "README.md"), "# Test Project\n\nThis is a test project.");
    
    await fs.writeFile(path.join(tempDir, "src", "index.ts"), `export function hello() {
  return "Hello, World!";
}`);
    
    await fs.writeFile(path.join(tempDir, "src", "utils.ts"), `export function add(a: number, b: number) {
  return a + b;
}`);
    
    await fs.writeFile(path.join(tempDir, "test", "index.test.ts"), `import { hello } from "../src/index";

test("hello", () => {
  expect(hello()).toBe("Hello, World!");
});`);

    // Create project config
    await fs.writeFile(path.join(tempDir, ".tenex", "config.json"), JSON.stringify({
      title: "Test Project",
      description: "A test project for inventory service",
      projectNaddr: "naddr1234",
      paths: {
        inventory: "context/INVENTORY.md"
      }
    }));

    service = new InventoryService(tempDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test("should generate complete inventory", async () => {
    const inventory = await service.generateInventory();

    expect(inventory).toBeDefined();
    expect(inventory.projectPath).toBe(tempDir);
    expect(inventory.projectDescription).toBe("A test project for inventory service");
    expect(inventory.version).toBe("1.0.0");
    
    // Check technologies
    expect(inventory.technologies).toContain("Node.js");
    expect(inventory.technologies).toContain("TypeScript");
    
    // Check files
    expect(inventory.files).toHaveLength(6); // package.json, tsconfig.json, README.md, index.ts, utils.ts, index.test.ts
    
    const indexFile = inventory.files.find(f => f.path === "src/index.ts");
    expect(indexFile).toBeDefined();
    expect(indexFile?.type).toBe(".ts");
    
    // Check directories
    expect(inventory.directories.length).toBeGreaterThan(0);
    const srcDir = inventory.directories.find(d => d.path === "src");
    expect(srcDir).toBeDefined();
    expect(srcDir?.fileCount).toBe(2);
    
    // Check stats
    expect(inventory.stats.totalFiles).toBe(6);
    expect(inventory.stats.fileTypes[".json"]).toBe(2);
    expect(inventory.stats.fileTypes[".ts"]).toBe(3);
    expect(inventory.stats.fileTypes[".md"]).toBe(1);
  });

  test("should save and load inventory", async () => {
    const originalInventory = await service.generateInventory();
    await service.saveInventory(originalInventory);
    
    const loadedInventory = await service.loadInventory();
    
    expect(loadedInventory).toBeDefined();
    expect(loadedInventory?.projectPath).toBe(originalInventory.projectPath);
    expect(loadedInventory?.files.length).toBe(originalInventory.files.length);
    expect(loadedInventory?.technologies).toEqual(originalInventory.technologies);
  });

  test("should update inventory for changed files", async () => {
    // Generate initial inventory
    const initialInventory = await service.generateInventory();
    await service.saveInventory(initialInventory);
    
    // Add a new file
    await fs.writeFile(path.join(tempDir, "src", "new-file.ts"), `export const VERSION = "1.0.0";`);
    
    // Update inventory
    const result = await service.updateInventory(["src/new-file.ts"]);
    
    expect(result.added).toContain("src/new-file.ts");
    expect(result.modified).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.inventory.files.length).toBe(initialInventory.files.length + 1);
  });

  test("should detect removed files", async () => {
    // Generate initial inventory
    const initialInventory = await service.generateInventory();
    await service.saveInventory(initialInventory);
    
    // Remove a file
    await fs.unlink(path.join(tempDir, "src", "utils.ts"));
    
    // Update inventory
    const result = await service.updateInventory(["src/utils.ts"]);
    
    expect(result.removed).toContain("src/utils.ts");
    expect(result.inventory.files.length).toBe(initialInventory.files.length - 1);
  });

  test("should detect modified files", async () => {
    // Generate initial inventory
    const initialInventory = await service.generateInventory();
    await service.saveInventory(initialInventory);
    
    // Wait a bit to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Modify a file
    await fs.writeFile(path.join(tempDir, "src", "index.ts"), `export function hello() {
  return "Hello, TypeScript!";
}

export function goodbye() {
  return "Goodbye!";
}`);
    
    // Update inventory
    const result = await service.updateInventory(["src/index.ts"]);
    
    expect(result.modified).toContain("src/index.ts");
    
    const modifiedFile = result.inventory.files.find(f => f.path === "src/index.ts");
    expect(modifiedFile).toBeDefined();
    expect(modifiedFile?.size).toBeGreaterThan(40); // Larger than before
  });

  test("should format inventory as markdown", async () => {
    const inventory = await service.generateInventory();
    await service.saveInventory(inventory);
    
    // Read the saved markdown file
    const inventoryPath = path.join(tempDir, ".tenex", "context", "INVENTORY.md");
    const markdown = await fs.readFile(inventoryPath, "utf-8");
    
    expect(markdown).toContain("# Project Inventory");
    expect(markdown).toContain("A test project for inventory service");
    expect(markdown).toContain("Node.js, TypeScript");
    expect(markdown).toContain("## Directory Structure");
    expect(markdown).toContain("## Files");
    expect(markdown).toContain("INVENTORY_DATA:");
  });

  test("should handle custom inventory path", async () => {
    // Create service with custom config
    const customConfig = {
      inventoryPath: "docs/PROJECT_INVENTORY.md"
    };
    
    const customService = new InventoryService(tempDir, customConfig);
    const inventory = await customService.generateInventory();
    await customService.saveInventory(inventory);
    
    // Check that file was saved to custom path
    // Note: InventoryService always saves under .tenex/<inventoryPath>
    const customPath = path.join(tempDir, ".tenex", "docs", "PROJECT_INVENTORY.md");
    const exists = await fs.access(customPath).then(() => true).catch(() => false);
    
    expect(exists).toBe(true);
  });

  test("should tag files appropriately", async () => {
    // Add files with specific patterns
    await fs.writeFile(path.join(tempDir, "src", "UserService.ts"), "export class UserService {}");
    await fs.writeFile(path.join(tempDir, "src", "Button.component.tsx"), "export const Button = () => {};");
    await fs.writeFile(path.join(tempDir, "src", "config.ts"), "export const config = {};");
    
    const inventory = await service.generateInventory();
    
    const serviceFile = inventory.files.find(f => f.path === "src/UserService.ts");
    expect(serviceFile?.tags).toContain("service");
    
    const componentFile = inventory.files.find(f => f.path === "src/Button.component.tsx");
    expect(componentFile?.tags).toContain("component");
    
    const configFile = inventory.files.find(f => f.path === "src/config.ts");
    expect(configFile?.tags).toContain("configuration");
    
    const testFile = inventory.files.find(f => f.path === "test/index.test.ts");
    expect(testFile?.tags).toContain("test");
  });

  test("should calculate diff between inventories", () => {
    const oldInventory: ProjectInventory = {
      projectPath: tempDir,
      generatedAt: Date.now() - 1000,
      version: "1.0.0",
      projectDescription: "Test",
      technologies: ["Node.js"],
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
      directories: [],
      stats: {
        totalFiles: 2,
        totalDirectories: 0,
        totalSize: 300,
        fileTypes: { ".ts": 2 },
      },
    };

    const newInventory: ProjectInventory = {
      ...oldInventory,
      files: [
        {
          path: "file1.ts",
          type: ".ts",
          description: "File 1",
          size: 150,
          lastModified: 3000,
        },
        {
          path: "file3.ts",
          type: ".ts",
          description: "File 3",
          size: 300,
          lastModified: 4000,
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
  });
});