import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { nip19 } from "nostr-tools";

const CLI_PATH = path.join(__dirname, "../../bin/tenex.ts");
const TEST_DIR = path.join(process.cwd(), "test-integration-temp");

describe("TENEX CLI Integration Tests", () => {
    beforeEach(async () => {
        // Create test directory
        await fs.mkdir(TEST_DIR, { recursive: true });
    });

    afterEach(async () => {
        // Clean up test directory
        await fs.rm(TEST_DIR, { recursive: true, force: true });
    });

    describe("tenex project init", () => {
        test("should initialize a new project", async () => {
            const projectPath = path.join(TEST_DIR, "test-project");
            // Create a mock naddr for testing
            const naddr = nip19.naddrEncode({
                identifier: "test-project",
                pubkey: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                kind: 31933,
            });

            const result = await runCommand(["project", "init", projectPath, naddr]);

            if (result.code !== 0) {
                console.error("Command failed with stderr:", result.stderr);
                console.error("Command failed with stdout:", result.stdout);
            }

            expect(result.code).toBe(0);
            expect(result.stdout).toContain("Project created successfully");

            // Verify project structure was created
            await expect(fs.access(path.join(projectPath, ".tenex"))).resolves.toBeUndefined();
            await expect(
                fs.access(path.join(projectPath, ".tenex", "metadata.json"))
            ).resolves.toBeUndefined();
            await expect(
                fs.access(path.join(projectPath, ".tenex", "agents.json"))
            ).resolves.toBeUndefined();
        }, 30000); // 30 second timeout for network operations
    });

    describe("tenex daemon", () => {
        test("should start daemon with whitelisted pubkeys", async () => {
            const pubkey1 = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
            const pubkey2 = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

            const daemon = spawnCommand(["daemon", "--whitelist", `${pubkey1},${pubkey2}`]);

            // Wait for daemon to start
            const startupOutput = await waitForOutput(daemon, "TENEX daemon is running", 5000);
            expect(startupOutput).toBeTruthy();

            // Verify daemon is running
            expect(daemon.killed).toBe(false);

            // Stop daemon
            daemon.kill("SIGTERM");

            // Wait for graceful shutdown
            const shutdownOutput = await waitForOutput(daemon, "Daemon shutdown complete", 5000);
            expect(shutdownOutput).toBeTruthy();
        }, 10000);

        test("should reject daemon without whitelisted pubkeys", async () => {
            const result = await runCommand(["daemon"]);

            expect(result.code).toBe(1);
            expect(result.stderr).toContain("No whitelisted pubkeys provided");
        });
    });

    describe("tenex project run", () => {
        test("should run project listener", async () => {
            // First create a project
            const projectPath = path.join(TEST_DIR, "run-test-project");
            await fs.mkdir(path.join(projectPath, ".tenex"), { recursive: true });

            // Create minimal metadata
            const metadata = {
                title: "Test Project",
                naddr: nip19.naddrEncode({
                    identifier: "test-project",
                    pubkey: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                    kind: 31933,
                }),
            };
            await fs.writeFile(
                path.join(projectPath, ".tenex", "metadata.json"),
                JSON.stringify(metadata, null, 2)
            );

            // Create agents.json
            await fs.writeFile(
                path.join(projectPath, ".tenex", "agents.json"),
                JSON.stringify({ default: { nsec: generateTestNsec() } }, null, 2)
            );

            const projectRun = spawnCommand(["project", "run", "--path", projectPath]);

            // Wait for project to start
            const startupOutput = await waitForOutput(projectRun, "Ready to process events", 10000);
            expect(startupOutput).toBeTruthy();

            // Verify it's running
            expect(projectRun.killed).toBe(false);

            // Stop the process
            projectRun.kill("SIGTERM");

            // Wait for shutdown
            const shutdownOutput = await waitForOutput(
                projectRun,
                "Project shutdown complete",
                5000
            );
            expect(shutdownOutput).toBeTruthy();
        }, 15000);
    });

    describe("command help", () => {
        test("should show help for main command", async () => {
            const result = await runCommand(["--help"]);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain("TENEX Command Line Interface");
            expect(result.stdout).toContain("daemon");
            expect(result.stdout).toContain("project");
            expect(result.stdout).toContain("debug");
        });

        test("should show help for project command", async () => {
            const result = await runCommand(["project", "--help"]);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain("Project management commands");
            expect(result.stdout).toContain("init");
            expect(result.stdout).toContain("run");
        });
    });
});

// Helper functions
function runCommand(
    args: string[]
): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
        const proc = spawn("bun", ["run", CLI_PATH, ...args], {
            cwd: process.cwd(),
            stdio: "pipe",
        });

        let stdout = "";
        let stderr = "";

        proc.stdout?.on("data", (data) => {
            stdout += data.toString();
        });

        proc.stderr?.on("data", (data) => {
            stderr += data.toString();
        });

        proc.on("close", (code) => {
            resolve({ code, stdout, stderr });
        });
    });
}

function spawnCommand(args: string[]) {
    return spawn("bun", ["run", CLI_PATH, ...args], {
        cwd: process.cwd(),
        stdio: "pipe",
    });
}

function waitForOutput(proc: ChildProcess, searchText: string, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
        let found = false;
        const timer = setTimeout(() => {
            if (!found) resolve(false);
        }, timeout);

        const checkOutput = (data: Buffer) => {
            const text = data.toString();
            if (text.includes(searchText)) {
                found = true;
                clearTimeout(timer);
                resolve(true);
            }
        };

        proc.stdout?.on("data", checkOutput);
        proc.stderr?.on("data", checkOutput);
    });
}

function generateTestNsec(): string {
    // Generate a valid test nsec
    const privateKey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        privateKey[i] = Math.floor(Math.random() * 256);
    }
    return nip19.nsecEncode(privateKey);
}
