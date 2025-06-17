import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import * as child_process from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { default as NDK, NDKProject } from "@nostr-dev-kit/ndk";
import { ProjectService } from "@tenex/shared/projects";
import { nip19 } from "nostr-tools";
import { ProjectManager } from "../../../src/core/ProjectManager";

// Helper to create valid naddr for testing
function createTestNaddr(): string {
    const addressPointer: nip19.AddressPointer = {
        identifier: "test-project",
        pubkey: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        kind: 31933,
        relays: ["wss://relay.example.com"],
    };
    return nip19.naddrEncode(addressPointer);
}

// Mock NDK
const mockNDK = {
    connect: mock(() => Promise.resolve()),
    pool: {
        relays: new Map(),
    },
    fetchEvent: mock((filter: any) => {
        // Return a mock agent event
        if (filter.ids?.[0]?.startsWith("agent-event-")) {
            return Promise.resolve({
                kind: 4199,
                id: filter.ids[0],
                pubkey: "agent-pubkey",
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ["title", "Test Agent"],
                    ["description", "A test agent"],
                    ["role", "Test role"],
                    ["instructions", "Test instructions"],
                ],
                tagValue: (tagName: string) => {
                    if (tagName === "title") return "Test Agent";
                    if (tagName === "description") return "A test agent";
                    if (tagName === "role") return "Test role";
                    if (tagName === "instructions") return "Test instructions";
                    return undefined;
                },
            });
        }
        // Handle project event fetch by filter
        if (filter.kinds?.[0] === 31933 && filter["#d"]?.[0] === "test-project") {
            const tags = [
                ["d", "test-project"],
                ["title", "Test Project"],
                // Remove repo tag to avoid git clone
                ["t", "ai"],
                ["t", "nostr"],
                ["agent", "agent-event-1"],
                ["agent", "agent-event-2"],
            ];
            return Promise.resolve({
                kind: 31933,
                id: "project-event-id",
                pubkey: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                created_at: Math.floor(Date.now() / 1000),
                tags,
                content: "Test Description",
                dTag: "test-project",
                title: "Test Project",
                summary: "Test Description",
                author: {
                    pubkey: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                },
                tagValue: (tagName: string) => {
                    const tag = tags.find((t) => t[0] === tagName);
                    return tag ? tag[1] : undefined;
                },
                getMatchingTags: (tagName: string) => {
                    return tags.filter((t) => t[0] === tagName).map((t) => t[1]);
                },
            });
        }
        return Promise.resolve(null);
    }),
};

mock.module("@nostr-dev-kit/ndk", () => ({
    default: mock(function NDK() {
        return mockNDK;
    }),
}));

// Mock dependencies
mock.module("@tenex/shared", () => ({
    logger: {
        info: mock(() => {}),
        error: mock(() => {}),
        warn: mock(() => {}),
        debug: mock(() => {}),
    },
    getRelayUrls: mock(() => ["wss://relay.test"]),
}));

// Mock child_process
mock.module("node:child_process", () => ({
    exec: mock((_cmd: string, callback: (err: any, stdout: string, stderr: string) => void) => {
        // Simulate successful git clone
        setTimeout(() => callback(null, "Cloned successfully", ""), 0);
    }),
}));

// Mock node:util
mock.module("node:util", () => ({
    promisify: mock((fn: any) => {
        return (...args: any[]) => {
            return new Promise((resolve, reject) => {
                fn(...args, (err: any, stdout: string, stderr: string) => {
                    if (err) reject(err);
                    else resolve({ stdout, stderr });
                });
            });
        };
    }),
}));

// Create mock ProjectService instance
const mockProjectServiceInstance = {
    fetchProject: mock(() => Promise.resolve()),
    cloneRepository: mock(() => Promise.resolve()),
    createProjectStructure: mock(() => Promise.resolve()),
};

// Mock ProjectService constructor
mock.module("@tenex/shared/projects", () => ({
    ProjectService: mock(() => mockProjectServiceInstance),
}));

describe("ProjectManager", () => {
    let projectManager: ProjectManager;
    let mockProjectService: {
        fetchProject: ReturnType<typeof mock>;
        cloneRepository: ReturnType<typeof mock>;
        createProjectStructure: ReturnType<typeof mock>;
    };
    let tempDir: string;

    beforeEach(async () => {
        // Create temp directory for tests
        tempDir = path.join(process.cwd(), "test-temp", Date.now().toString());
        await fs.mkdir(tempDir, { recursive: true });

        // Spy on child_process.exec to prevent actual git clone
        spyOn(child_process, "exec").mockImplementation((_cmd: string, callback: any) => {
            // Simulate successful git clone
            setTimeout(() => callback(null, "Cloned successfully", ""), 0);
        });

        // Reset mocks and set up return values
        mockProjectServiceInstance.fetchProject.mockReset();
        mockProjectServiceInstance.cloneRepository.mockReset();
        mockProjectServiceInstance.createProjectStructure.mockReset();

        mockProjectServiceInstance.fetchProject.mockImplementation((_naddr: string) => {
            // Create a mock project object that matches NDKProject structure
            const project = {
                kind: 31933,
                dTag: "test-project",
                pubkey: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                title: "Test Project",
                summary: "Test Description",
                content: "Test content",
                tags: [
                    // Remove repo tag to avoid git clone
                    ["t", "ai"],
                    ["t", "nostr"],
                    ["agent", "agent-event-1"],
                    ["agent", "agent-event-2"],
                ],
                created_at: Math.floor(Date.now() / 1000),
                tagValue: (tagName: string) => {
                    if (tagName === "repo") return undefined;
                    if (tagName === "d") return "test-project";
                    return undefined;
                },
            };
            return Promise.resolve(project as unknown as NDKProject);
        });

        mockProjectServiceInstance.cloneRepository.mockImplementation(() => Promise.resolve());
        mockProjectServiceInstance.createProjectStructure.mockImplementation(
            async (projectPath: string, project: { title: string; naddr: string }) => {
                // Actually create the directory structure that the real implementation would create
                const tenexDir = path.join(projectPath, ".tenex");
                await fs.mkdir(tenexDir, { recursive: true });
                await fs.mkdir(path.join(tenexDir, "agents"), { recursive: true });
                await fs.mkdir(path.join(tenexDir, "conversations"), { recursive: true });

                const metadataPath = path.join(tenexDir, "metadata.json");
                await fs.writeFile(
                    metadataPath,
                    JSON.stringify(
                        {
                            title: project.title,
                            naddr: project.naddr,
                            createdAt: new Date().toISOString(),
                        },
                        null,
                        2
                    )
                );

                const agentsPath = path.join(tenexDir, "agents.json");
                await fs.writeFile(agentsPath, JSON.stringify({}, null, 2));
            }
        );

        // Use the mockProjectServiceInstance for convenience
        mockProjectService = mockProjectServiceInstance;

        projectManager = new ProjectManager();
    });

    afterEach(async () => {
        // Clean up temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    describe("initializeProject", () => {
        test("should initialize a new project successfully", async () => {
            const projectPath = path.join(tempDir, "test-project");
            const naddr = createTestNaddr();

            const result = await projectManager.initializeProject(
                projectPath,
                naddr,
                mockNDK as unknown as NDK
            );

            expect(result).toEqual({
                identifier: "test-project",
                pubkey: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                naddr,
                title: "Test Project",
                description: "Test Description",
                repoUrl: undefined,
                hashtags: ["ai", "nostr"],
                agentEventIds: ["agent-event-1", "agent-event-2"],
                createdAt: expect.any(Number),
                updatedAt: expect.any(Number),
            });

            // Verify project structure was created
            const tenexDir = path.join(projectPath, ".tenex");
            expect(await fs.exists(tenexDir)).toBe(true);
            expect(await fs.exists(path.join(tenexDir, "config.json"))).toBe(true);
            expect(await fs.exists(path.join(tenexDir, "agents.json"))).toBe(true);

            // Verify agent files were fetched
            const agentsDir = path.join(tenexDir, "agents");
            expect(await fs.exists(agentsDir)).toBe(true);
        });

        test("should handle project without repository", async () => {
            mockProjectService.fetchProject = mock(() => {
                const project = {
                    kind: 31933,
                    dTag: "test-project",
                    pubkey: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                    title: "Test Project",
                    summary: "Test Description",
                    content: "Test content",
                    tags: [["agent", "agent-event-1"]],
                    created_at: Math.floor(Date.now() / 1000),
                    tagValue: (tagName: string) => {
                        if (tagName === "d") return "test-project";
                        return undefined;
                    },
                };
                return Promise.resolve(project as unknown as NDKProject);
            });

            const projectPath = path.join(tempDir, "test-project");
            const naddr = createTestNaddr();

            const result = await projectManager.initializeProject(
                projectPath,
                naddr,
                mockNDK as unknown as NDK
            );

            expect(result.repoUrl).toBeUndefined();
            expect(mockProjectService.cloneRepository).not.toHaveBeenCalled();
        });

        test("should handle errors gracefully", async () => {
            // Create a new mock NDK that will reject
            const failingMockNDK = {
                ...mockNDK,
                fetchEvent: mock(() => Promise.reject(new Error("Network error"))),
            };

            const projectPath = path.join(tempDir, "test-project");
            const naddr = createTestNaddr();

            await expect(
                projectManager.initializeProject(projectPath, naddr, failingMockNDK as any)
            ).rejects.toThrow("Network error");
        });
    });

    describe("loadProject", () => {
        test("should load existing project successfully", async () => {
            const projectPath = path.join(tempDir, "existing-project");
            const tenexDir = path.join(projectPath, ".tenex");
            await fs.mkdir(tenexDir, { recursive: true });

            // Generate valid 32-byte hex pubkey
            const pubkeyHex = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

            const config = {
                title: "Existing Project",
                projectNaddr: nip19.naddrEncode({
                    identifier: "existing-project",
                    pubkey: pubkeyHex,
                    kind: 31933,
                }),
                description: "Test description",
                repoUrl: "https://github.com/test/existing",
                hashtags: ["test"],
                createdAt: Date.now() - 86400000,
                updatedAt: Date.now(),
            };

            await fs.writeFile(path.join(tenexDir, "config.json"), JSON.stringify(config, null, 2));

            const result = await projectManager.loadProject(projectPath);

            expect(result).toEqual({
                identifier: "existing-project",
                pubkey: pubkeyHex,
                naddr: config.projectNaddr,
                title: "Existing Project",
                description: "Test description",
                repoUrl: "https://github.com/test/existing",
                hashtags: ["test"],
                agentEventIds: [],
                createdAt: config.createdAt,
                updatedAt: config.updatedAt,
            });
        });

        test("should throw error if metadata is missing", async () => {
            const projectPath = path.join(tempDir, "missing-metadata");

            await expect(projectManager.loadProject(projectPath)).rejects.toThrow(
                `Failed to load project from ${projectPath}`
            );
        });

        test("should throw error if naddr is invalid", async () => {
            const projectPath = path.join(tempDir, "invalid-naddr");
            const tenexDir = path.join(projectPath, ".tenex");
            await fs.mkdir(tenexDir, { recursive: true });

            await fs.writeFile(
                path.join(tenexDir, "metadata.json"),
                JSON.stringify({ naddr: "invalid" }, null, 2)
            );

            await expect(projectManager.loadProject(projectPath)).rejects.toThrow();
        });
    });

    describe("ensureProjectExists", () => {
        test("should return existing project path", async () => {
            const identifier = "existing-project";
            const projectPath = path.join(process.cwd(), "projects", identifier);
            const tenexDir = path.join(projectPath, ".tenex");

            await fs.mkdir(tenexDir, { recursive: true });

            const result = await projectManager.ensureProjectExists(identifier, createTestNaddr());

            expect(result).toBe(projectPath);
            expect(mockProjectService.fetchProject).not.toHaveBeenCalled();
        });

        test("should initialize new project if it doesn't exist", async () => {
            const identifier = `totally-new-project-${Date.now()}`;
            const naddr = createTestNaddr();
            const expectedPath = path.join(process.cwd(), "projects", identifier);

            // Since the project doesn't exist, it should call initializeProject
            const result = await projectManager.ensureProjectExists(
                identifier,
                naddr,
                mockNDK as unknown as NDK
            );

            expect(result).toBe(expectedPath);
            // Verify that the project was initialized (directory exists)
            expect(await fs.exists(expectedPath)).toBe(true);
            expect(await fs.exists(path.join(expectedPath, ".tenex"))).toBe(true);
        });
    });
});
