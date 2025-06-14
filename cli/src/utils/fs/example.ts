import { MockFileSystem } from "./MockFileSystem";
/**
 * Example usage of the File System Abstraction Layer
 */
import { fs } from "./index";

// Example 1: Basic file operations
async function basicOperations() {
    // Read a file with automatic ~ expansion
    const content = await fs.readFile("~/.tenex/config.json", "utf8");
    console.log("Config content:", content);

    // Write a file (directory created automatically)
    await fs.writeFile("./output/data.txt", "Hello, World!");

    // Check if file exists
    if (await fs.exists("./output/data.txt")) {
        console.log("File created successfully");
    }

    // Copy file
    await fs.copyFile("./output/data.txt", "./output/backup.txt");

    // List files
    const files = await fs.listFiles("./output");
    console.log("Files:", files);
}

// Example 2: JSON operations
async function jsonOperations() {
    interface Config {
        version: string;
        projects: Array<{ name: string; path: string }>;
    }

    // Write JSON
    const config: Config = {
        version: "1.0.0",
        projects: [
            { name: "project1", path: "./projects/project1" },
            { name: "project2", path: "./projects/project2" },
        ],
    };
    await fs.writeJSON("./config.json", config);

    // Read JSON with type safety
    const loadedConfig = await fs.readJSON<Config>("./config.json");
    console.log("Loaded config:", loadedConfig);

    // Update and save
    loadedConfig.projects.push({ name: "project3", path: "./projects/project3" });
    await fs.writeJSON("./config.json", loadedConfig);
}

// Example 3: Directory operations
async function directoryOperations() {
    // Ensure nested directories exist
    await fs.ensureDir("./projects/my-project/.tenex/agents");

    // List all files recursively
    const allFiles = await fs.listFiles("./projects", true);
    console.log("All project files:", allFiles);

    // Clean up
    await fs.rmdir("./projects/my-project", { recursive: true });
}

// Example 4: Testing with MockFileSystem
async function testingExample() {
    // Create a mock file system with initial data
    const mockFs = new MockFileSystem({
        "/home/user/.tenex/config.json": JSON.stringify({
            version: "1.0.0",
            apiKey: "test-key",
        }),
        "/home/user/project/README.md": "# Test Project",
    });

    // Use the mock in tests
    const config = await mockFs.readJSON("/home/user/.tenex/config.json");
    console.log("Mock config:", config);

    // Write new files to the mock
    await mockFs.writeFile("/home/user/project/src/index.ts", 'console.log("Hello");');

    // Verify files were created
    const files = mockFs.getAllFiles();
    console.log("All mock files:", files);

    // Test error conditions
    try {
        await mockFs.readFile("/nonexistent/file.txt");
    } catch (error) {
        console.log("Expected error:", error.message);
    }
}

// Example 5: Path utilities
function pathUtilities() {
    // Expand home directory
    console.log(fs.expandHome("~/.tenex")); // /home/username/.tenex

    // Join paths
    console.log(fs.join("projects", "my-project", "src")); // projects/my-project/src

    // Get directory and basename
    console.log(fs.dirname("/path/to/file.txt")); // /path/to
    console.log(fs.basename("/path/to/file.txt")); // file.txt
    console.log(fs.extname("/path/to/file.txt")); // .txt

    // Resolve paths
    console.log(fs.resolvePath(".", "config.json")); // /absolute/path/to/config.json
}

// Example 6: Error handling patterns
async function errorHandling() {
    try {
        const _data = await fs.readFile("./missing-file.txt", "utf8");
    } catch (error) {
        if (error.message.includes("ENOENT")) {
            console.log("File not found, creating default...");
            await fs.writeFile("./missing-file.txt", "default content");
        } else {
            throw error;
        }
    }
}

// Example 7: Synchronous operations (when async isn't possible)
function syncOperations() {
    // Sometimes you need sync operations (e.g., in constructors)
    if (fs.existsSync("./config.json")) {
        const config = fs.readJSONSync("./config.json");
        console.log("Sync config:", config);
    }

    // Write sync
    fs.writeJSONSync("./backup.json", { timestamp: Date.now() });
}

// Export all examples to avoid unused warnings
export {
    basicOperations,
    jsonOperations,
    directoryOperations,
    testingExample,
    pathUtilities,
    errorHandling,
    syncOperations
};
