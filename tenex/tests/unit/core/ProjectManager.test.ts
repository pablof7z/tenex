import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import type { default as NDK, NDKProject } from "@nostr-dev-kit/ndk";
import { ProjectService } from "@tenex/shared/projects";
import { nip19 } from "nostr-tools";
import { ProjectManager } from "../../../src/core/ProjectManager";

// Mock NDK
const mockNDK = {
    connect: mock(() => Promise.resolve()),
    pool: {
        relays: new Map(),
    },
    fetchEvent: mock((filter: { ids?: string[] }) => {
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
                    ["repo", "https://github.com/test/repo"],
                    ["t", "ai"],
                    ["t", "nostr"],
                    ["agent", "agent-event-1"],
                    ["agent", "agent-event-2"],
                ],
                created_at: Math.floor(Date.now() / 1000),
                tagValue: (tagName: string) => {
                    if (tagName === "repo") return "https://github.com/test/repo";
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
            const naddr = "naddr1test";

            const result = await projectManager.initializeProject(
                projectPath,
                naddr,
                mockNDK as unknown as NDK
            );

            expect(result).toEqual({
                identifier: "test-project",
                pubkey: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                naddr: "naddr1test",
                title: "Test Project",
                description: "Test Description",
                repoUrl: "https://github.com/test/repo",
                hashtags: ["ai", "nostr"],
                agentEventIds: ["agent-event-1", "agent-event-2"],
                createdAt: expect.any(Number),
                updatedAt: expect.any(Number),
            });

            // Verify service calls
            expect(mockProjectService.fetchProject).toHaveBeenCalledWith(naddr, mockNDK);
            expect(mockProjectService.cloneRepository).toHaveBeenCalledWith(
                "https://github.com/test/repo",
                projectPath
            );
            expect(mockProjectService.createProjectStructure).toHaveBeenCalled();
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
            const naddr = "naddr1test";

            const result = await projectManager.initializeProject(
                projectPath,
                naddr,
                mockNDK as unknown as NDK
            );

            expect(result.repoUrl).toBeUndefined();
            expect(mockProjectService.cloneRepository).not.toHaveBeenCalled();
        });

        test("should handle errors gracefully", async () => {
            mockProjectService.fetchProject = mock(() =>
                Promise.reject(new Error("Network error"))
            );

            const projectPath = path.join(tempDir, "test-project");
            const naddr = "naddr1test";

            await expect(
                projectManager.initializeProject(projectPath, naddr, mockNDK as any)
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

            const metadata = {
                title: "Existing Project",
                naddr: nip19.naddrEncode({
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

            await fs.writeFile(
                path.join(tenexDir, "metadata.json"),
                JSON.stringify(metadata, null, 2)
            );

            const result = await projectManager.loadProject(projectPath);

            expect(result).toEqual({
                identifier: "existing-project",
                pubkey: pubkeyHex,
                naddr: metadata.naddr,
                title: "Existing Project",
                description: "Test description",
                repoUrl: "https://github.com/test/existing",
                hashtags: ["test"],
                agentEventIds: [],
                createdAt: metadata.createdAt,
                updatedAt: metadata.updatedAt,
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

            const result = await projectManager.ensureProjectExists(identifier, "naddr1test");

            expect(result).toBe(projectPath);
            expect(mockProjectService.fetchProject).not.toHaveBeenCalled();
        });

        test("should initialize new project if it doesn't exist", async () => {
            const identifier = `totally-new-project-${Date.now()}`;
            const naddr = "naddr1new";
            const expectedPath = path.join(process.cwd(), "projects", identifier);

            // Since the project doesn't exist, it should call initializeProject
            const result = await projectManager.ensureProjectExists(
                identifier,
                naddr,
                mockNDK as unknown as NDK
            );

            expect(result).toBe(expectedPath);
            // Verify that fetchProject was called during initialization
            expect(mockProjectService.fetchProject).toHaveBeenCalledWith(naddr, mockNDK);
            expect(mockProjectService.createProjectStructure).toHaveBeenCalled();
        });
    });
});
