import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import path from "node:path";
import { ProcessManager } from "../../../src/core/ProcessManager";

// Mock child process
class MockChildProcess extends EventEmitter {
    pid: number;
    stdout: EventEmitter | null;
    stderr: EventEmitter | null;

    constructor(pid: number) {
        super();
        this.pid = pid;
        this.stdout = new EventEmitter();
        this.stderr = new EventEmitter();
    }

    kill(signal?: string) {
        setTimeout(() => this.emit("exit", 0, signal), 10);
    }
}

// Mock dependencies
const mockLogger = {
    info: mock(() => {}),
    error: mock(() => {}),
    warn: mock(() => {}),
    debug: mock(() => {}),
};

mock.module("node:child_process", () => ({
    spawn: mock((_command: string, _args: string[], _options: unknown) => {
        const child = new MockChildProcess(12345);
        setTimeout(() => child.emit("spawn"), 0);
        return child;
    }),
}));

mock.module("@tenex/shared", () => ({
    logger: mockLogger,
}));

describe("ProcessManager", () => {
    let processManager: ProcessManager;
    let mockChildProcess: MockChildProcess;

    beforeEach(() => {
        processManager = new ProcessManager();

        // Setup spawn mock to return our mock child process
        const spawnMock = spawn as ReturnType<typeof mock>;
        spawnMock.mockImplementation(() => {
            mockChildProcess = new MockChildProcess(12345);
            setTimeout(() => mockChildProcess.emit("spawn"), 0);
            return mockChildProcess;
        });
    });

    describe("spawnProjectRun", () => {
        test("should spawn a new project process", async () => {
            const projectPath = "/test/project";
            const projectId = "test-project";

            await processManager.spawnProjectRun(projectPath, projectId);

            expect(spawn).toHaveBeenCalledWith(
                "bun",
                ["run", expect.stringContaining("tenex.ts"), "project", "run"],
                {
                    cwd: projectPath,
                    stdio: ["ignore", "pipe", "pipe"],
                    detached: false,
                }
            );
        });

        test("should use project path basename as ID if not provided", async () => {
            const projectPath = "/test/my-project";

            await processManager.spawnProjectRun(projectPath);

            // Check that process is tracked with basename as ID
            expect(await processManager.isProjectRunning("my-project")).toBe(true);
        });

        test("should not spawn if project is already running", async () => {
            const projectPath = "/test/project";
            const projectId = "test-project";

            await processManager.spawnProjectRun(projectPath, projectId);
            const spawnMock = spawn as ReturnType<typeof mock>;
            const spawnCallCount = spawnMock.mock.calls.length;

            await processManager.spawnProjectRun(projectPath, projectId);

            expect(spawnMock.mock.calls.length).toBe(spawnCallCount);
        });

        test("should handle stdout data", async () => {
            const projectPath = "/test/project";
            const projectId = "test-project";

            await processManager.spawnProjectRun(projectPath, projectId);

            // Simulate stdout data
            if (mockChildProcess.stdout) {
                mockChildProcess.stdout.emit("data", Buffer.from("Test output\nAnother line"));
            }

            // Logger should be called for each line
            expect(mockLogger.info).toHaveBeenCalledWith("[test-project] Test output");
            expect(mockLogger.info).toHaveBeenCalledWith("[test-project] Another line");
        });

        test("should handle stderr data", async () => {
            const projectPath = "/test/project";
            const projectId = "test-project";

            await processManager.spawnProjectRun(projectPath, projectId);

            // Simulate stderr data
            if (mockChildProcess.stderr) {
                mockChildProcess.stderr.emit("data", Buffer.from("Error message"));
            }

            expect(mockLogger.error).toHaveBeenCalledWith("[test-project] Error message");
        });

        test("should remove process on exit", async () => {
            const projectPath = "/test/project";
            const projectId = "test-project";

            await processManager.spawnProjectRun(projectPath, projectId);
            expect(await processManager.isProjectRunning(projectId)).toBe(true);

            // Simulate process exit
            mockChildProcess.emit("exit", 0, null);
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(await processManager.isProjectRunning(projectId)).toBe(false);
        });

        test("should handle process errors", async () => {
            const projectPath = "/test/project";
            const projectId = "test-project";

            await processManager.spawnProjectRun(projectPath, projectId);

            // Simulate process error
            mockChildProcess.emit("error", new Error("Spawn error"));
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(await processManager.isProjectRunning(projectId)).toBe(false);
        });
    });

    describe("isProjectRunning", () => {
        test("should return true for running project", async () => {
            await processManager.spawnProjectRun("/test/project", "test-project");

            expect(await processManager.isProjectRunning("test-project")).toBe(true);
        });

        test("should return false for non-existent project", async () => {
            expect(await processManager.isProjectRunning("non-existent")).toBe(false);
        });

        test("should detect dead processes", async () => {
            await processManager.spawnProjectRun("/test/project", "test-project");

            // Mock process.kill to throw (process doesn't exist)
            const originalKill = process.kill;
            process.kill = mock(() => {
                throw new Error("No such process");
            });

            expect(await processManager.isProjectRunning("test-project")).toBe(false);

            process.kill = originalKill;
        });
    });

    describe("stopProject", () => {
        test("should stop running project gracefully", async () => {
            await processManager.spawnProjectRun("/test/project", "test-project");

            const killSpy = mock(() => {});
            const originalKill = process.kill;
            process.kill = killSpy;

            await processManager.stopProject("test-project");

            expect(killSpy).toHaveBeenCalledWith(mockChildProcess.pid, "SIGTERM");
            expect(await processManager.isProjectRunning("test-project")).toBe(false);

            process.kill = originalKill;
        });

        test("should force kill if graceful shutdown times out", async () => {
            await processManager.spawnProjectRun("/test/project", "test-project");

            const killSpy = mock(() => {});
            const originalKill = process.kill;
            process.kill = killSpy;

            // Don't emit exit event to simulate timeout
            mockChildProcess.kill = mock(() => {});

            const stopPromise = processManager.stopProject("test-project");

            // Wait for timeout
            await new Promise((resolve) => setTimeout(resolve, 5100));

            expect(killSpy).toHaveBeenCalledWith(mockChildProcess.pid, "SIGTERM");
            expect(killSpy).toHaveBeenCalledWith(mockChildProcess.pid, "SIGKILL");

            await stopPromise;
            process.kill = originalKill;
        });

        test("should handle non-existent project", async () => {
            await processManager.stopProject("non-existent");

            expect(mockLogger.warn).toHaveBeenCalledWith("Project not running", {
                projectId: "non-existent",
            });
        });
    });

    describe("stopAll", () => {
        test("should stop all running projects", async () => {
            await processManager.spawnProjectRun("/test/project1", "project1");
            await processManager.spawnProjectRun("/test/project2", "project2");
            await processManager.spawnProjectRun("/test/project3", "project3");

            await processManager.stopAll();

            expect(await processManager.isProjectRunning("project1")).toBe(false);
            expect(await processManager.isProjectRunning("project2")).toBe(false);
            expect(await processManager.isProjectRunning("project3")).toBe(false);
        });

        test("should handle empty process list", async () => {
            await processManager.stopAll();

            expect(mockLogger.info).toHaveBeenCalledWith("Stopping all projects", { count: 0 });
        });
    });

    describe("getRunningProjects", () => {
        test("should return list of running projects", async () => {
            const now = Date.now();

            await processManager.spawnProjectRun("/test/project1", "project1");
            await processManager.spawnProjectRun("/test/project2", "project2");

            const runningProjects = processManager.getRunningProjects();

            expect(runningProjects).toHaveLength(2);
            expect(runningProjects[0]).toEqual({
                id: "project1",
                path: "/test/project1",
                startedAt: expect.any(Date),
            });
            expect(runningProjects[1]).toEqual({
                id: "project2",
                path: "/test/project2",
                startedAt: expect.any(Date),
            });

            // Check that timestamps are recent
            expect(runningProjects[0].startedAt.getTime()).toBeGreaterThanOrEqual(now);
            expect(runningProjects[1].startedAt.getTime()).toBeGreaterThanOrEqual(now);
        });

        test("should return empty array when no projects running", () => {
            const runningProjects = processManager.getRunningProjects();
            expect(runningProjects).toEqual([]);
        });
    });
});
