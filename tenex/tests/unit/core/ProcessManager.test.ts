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

// Store reference to spawn mock
let spawnMock: ReturnType<typeof mock>;
let mockChildProcess: MockChildProcess;

mock.module("node:child_process", () => {
    spawnMock = mock((_command: string, _args: string[], _options: unknown) => {
        mockChildProcess = new MockChildProcess(12345);
        setTimeout(() => mockChildProcess.emit("spawn"), 0);
        return mockChildProcess;
    });
    return {
        spawn: spawnMock,
    };
});

mock.module("@tenex/shared", () => ({
    logger: mockLogger,
}));

// Mock process.kill for isProjectRunning checks
const originalProcessKill = process.kill;
const mockProcessKill = mock((pid: number, signal?: string | number) => {
    if (signal === 0 && pid === 12345) {
        // Simulate process exists
        return true;
    }
    return originalProcessKill(pid, signal as any);
});

describe("ProcessManager", () => {
    let processManager: ProcessManager;

    beforeEach(() => {
        processManager = new ProcessManager();
        // Reset the spawn mock
        spawnMock.mockClear();
        // Mock process.kill
        (global as any).process.kill = mockProcessKill;
    });

    afterEach(() => {
        // Restore original process.kill
        (global as any).process.kill = originalProcessKill;
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
                    stdio: "inherit",
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

        // Skip stdout/stderr tests since stdio is set to "inherit"

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

            // Start the stop process
            const stopPromise = processManager.stopProject("test-project");

            // Wait for SIGTERM to be sent
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(killSpy).toHaveBeenCalledWith(mockChildProcess.pid, "SIGTERM");

            // Wait for timeout (5 seconds + a bit extra)
            await new Promise((resolve) => setTimeout(resolve, 5100));

            // Should have sent SIGKILL after timeout
            expect(killSpy).toHaveBeenCalledWith(mockChildProcess.pid, "SIGKILL");

            // Emit exit to complete the promise
            mockChildProcess.emit("exit", 0, null);

            await stopPromise;
            process.kill = originalKill;
        }, 10000); // Increase test timeout to 10 seconds

        test("should handle non-existent project", async () => {
            await processManager.stopProject("non-existent");

            expect(mockLogger.warn).toHaveBeenCalledWith("Project not running", {
                projectId: "non-existent",
            });
        });
    });

    describe("stopAll", () => {
        test("should stop all running projects", async () => {
            // Create different child processes for each project
            const processes: MockChildProcess[] = [];
            let callCount = 0;

            // Override spawn mock to return different processes
            spawnMock.mockImplementation((_command: string, _args: string[], _options: unknown) => {
                const proc = new MockChildProcess(12345 + callCount);
                processes.push(proc);
                callCount++;
                setTimeout(() => proc.emit("spawn"), 0);
                return proc;
            });

            await processManager.spawnProjectRun("/test/project1", "project1");
            await processManager.spawnProjectRun("/test/project2", "project2");
            await processManager.spawnProjectRun("/test/project3", "project3");

            expect(processManager.getRunningProjects()).toHaveLength(3);

            // Mock process.kill to prevent ESRCH errors
            const killSpy = mock(() => {});
            const originalKill = process.kill;
            process.kill = killSpy;

            // Start stopAll
            const stopAllPromise = processManager.stopAll();

            // Wait a bit for SIGTERM to be sent
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Emit exit events for all processes
            processes.forEach((proc) => {
                proc.emit("exit", 0, null);
            });

            await stopAllPromise;

            expect(await processManager.isProjectRunning("project1")).toBe(false);
            expect(await processManager.isProjectRunning("project2")).toBe(false);
            expect(await processManager.isProjectRunning("project3")).toBe(false);

            process.kill = originalKill;
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
