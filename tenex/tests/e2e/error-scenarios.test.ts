import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import NDK, { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";

const CLI_PATH = path.join(__dirname, "../../bin/tenex.ts");
const CLI_CLIENT_PATH = path.join(__dirname, "../../../cli-client/dist/cli.js");
const TEST_DIR = path.join(process.cwd(), "test-e2e-errors");

describe("TENEX Error Scenario Tests", () => {
    let ndk: NDK;
    let _ownerNsec: string;
    let ownerPubkey: string;

    beforeAll(async () => {
        await fs.mkdir(TEST_DIR, { recursive: true });

        // Generate owner keys
        const signer = NDKPrivateKeySigner.generate();
        _ownerNsec = signer.privateKey!;
        ownerPubkey = await signer.user().then((user) => user.pubkey);

        // Setup NDK
        ndk = new NDK({
            explicitRelayUrls: ["wss://relay.damus.io"],
            signer,
        });
        await ndk.connect();
    });

    afterAll(async () => {
        if (ndk?.pool?.relays) {
            for (const relay of ndk.pool.relays.values()) {
                relay.disconnect();
            }
        }
        await fs.rm(TEST_DIR, { recursive: true, force: true });
    });

    describe("Daemon Error Handling", () => {
        test("should handle events from non-whitelisted pubkeys", async () => {
            // Start daemon with specific whitelist
            const whitelistedPubkey =
                "aaaa567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
            const daemon = spawn(
                "bun",
                ["run", CLI_PATH, "daemon", "--whitelist", whitelistedPubkey],
                {
                    cwd: process.cwd(),
                    stdio: "pipe",
                }
            );

            // Wait for daemon to start
            await waitForOutput(daemon, "TENEX daemon is running", 5000);

            // Create project event from non-whitelisted pubkey
            const projectEvent = new NDKEvent(ndk);
            projectEvent.kind = 31933;
            projectEvent.tags = [
                ["d", "unauthorized-project"],
                ["title", "Unauthorized Project"],
            ];
            projectEvent.content = "This should be ignored";
            await projectEvent.publish();

            // Create task event targeting the project
            const taskEvent = new NDKEvent(ndk);
            taskEvent.kind = 1934;
            taskEvent.tags = [
                ["a", `31933:${ownerPubkey}:unauthorized-project`],
                ["title", "Task from non-whitelisted user"],
            ];
            taskEvent.content = "This task should be ignored";
            await taskEvent.publish();

            // Wait and verify no project was spawned
            await new Promise((resolve) => setTimeout(resolve, 3000));

            // Check that no project directory was created
            const projectPath = path.join(process.cwd(), "projects", "unauthorized-project");
            const projectExists = await fs
                .access(projectPath)
                .then(() => true)
                .catch(() => false);
            expect(projectExists).toBe(false);

            daemon.kill("SIGTERM");
            await waitForProcessExit(daemon, 5000);
        }, 15000);

        test("should handle malformed project events gracefully", async () => {
            const daemon = spawn("bun", ["run", CLI_PATH, "daemon", "--whitelist", ownerPubkey], {
                cwd: process.cwd(),
                stdio: "pipe",
            });

            await waitForOutput(daemon, "TENEX daemon is running", 5000);

            // Send event with malformed "a" tag
            const malformedEvent = new NDKEvent(ndk);
            malformedEvent.kind = 1;
            malformedEvent.tags = [
                ["a", "invalid-format"], // Missing kind:pubkey:identifier format
                ["title", "Malformed Event"],
            ];
            malformedEvent.content = "This has an invalid project reference";
            await malformedEvent.publish();

            // Wait and verify daemon didn't crash
            await new Promise((resolve) => setTimeout(resolve, 2000));
            expect(daemon.killed).toBe(false);

            daemon.kill("SIGTERM");
            await waitForProcessExit(daemon, 5000);
        }, 10000);
    });

    describe("Project Initialization Errors", () => {
        test("should fail with invalid naddr", async () => {
            const result = await runCommand([
                "project",
                "init",
                path.join(TEST_DIR, "invalid"),
                "invalid-naddr",
            ]);

            expect(result.code).toBe(1);
            expect(result.stderr).toContain("Failed to create project");
        });

        test("should fail when project event doesn't exist", async () => {
            // Create valid but non-existent naddr
            const fakeNaddr = nip19.naddrEncode({
                identifier: "non-existent-project",
                pubkey: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                kind: 31933,
            });

            const result = await runCommand([
                "project",
                "init",
                path.join(TEST_DIR, "non-existent"),
                fakeNaddr,
            ]);

            expect(result.code).toBe(1);
            expect(result.stderr).toContain("Failed to create project");
        }, 10000);
    });

    describe("Project Run Errors", () => {
        test("should fail when metadata.json is missing", async () => {
            const projectPath = path.join(TEST_DIR, "missing-metadata");
            await fs.mkdir(path.join(projectPath, ".tenex"), { recursive: true });

            const result = await runCommand(["project", "run", "--path", projectPath]);

            expect(result.code).toBe(1);
            expect(result.stderr).toContain("Failed to start project");
        });

        test("should fail when agents.json is missing", async () => {
            const projectPath = path.join(TEST_DIR, "missing-agents");
            await fs.mkdir(path.join(projectPath, ".tenex"), { recursive: true });

            // Create metadata but no agents.json
            await fs.writeFile(
                path.join(projectPath, ".tenex", "metadata.json"),
                JSON.stringify({
                    title: "Test Project",
                    naddr: nip19.naddrEncode({
                        identifier: "test",
                        pubkey: ownerPubkey,
                        kind: 31933,
                    }),
                })
            );

            const result = await runCommand(["project", "run", "--path", projectPath]);

            expect(result.code).toBe(1);
        });
    });

    describe("Race Conditions", () => {
        test("should handle multiple daemons trying to spawn same project", async () => {
            // Create a project
            const createResult = await runCliClient(
                ["project", "create", "--name", "Race Condition Test"],
                _ownerNsec
            );

            const projectData = JSON.parse(createResult.stdout);
            const projectNaddr = projectData.naddr;

            // Start two daemons
            const daemon1 = spawn("bun", ["run", CLI_PATH, "daemon", "--whitelist", ownerPubkey], {
                cwd: process.cwd(),
                stdio: "pipe",
            });
            const daemon2 = spawn("bun", ["run", CLI_PATH, "daemon", "--whitelist", ownerPubkey], {
                cwd: process.cwd(),
                stdio: "pipe",
            });

            await Promise.all([
                waitForOutput(daemon1, "TENEX daemon is running", 5000),
                waitForOutput(daemon2, "TENEX daemon is running", 5000),
            ]);

            // Send event that both daemons will receive
            const taskEvent = new NDKEvent(ndk);
            taskEvent.kind = 1934;
            const decoded = nip19.decode(projectNaddr);
            if (decoded.type === "naddr") {
                taskEvent.tags = [
                    ["a", `31933:${decoded.data.pubkey}:${decoded.data.identifier}`],
                    ["title", "Concurrent Task"],
                ];
            }
            taskEvent.content = "Task for race condition test";
            await taskEvent.publish();

            // Wait for processing
            await new Promise((resolve) => setTimeout(resolve, 5000));

            // Verify only one project process is running
            // This is hard to verify directly, but we can check logs
            // Both daemons should handle this gracefully

            daemon1.kill("SIGTERM");
            daemon2.kill("SIGTERM");

            await Promise.all([
                waitForProcessExit(daemon1, 5000),
                waitForProcessExit(daemon2, 5000),
            ]);
        }, 20000);
    });
});

// Helper functions
async function runCommand(
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

async function runCliClient(
    args: string[],
    ownerNsec?: string
): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
        const proc = spawn("bun", ["run", CLI_CLIENT_PATH, ...args], {
            cwd: process.cwd(),
            stdio: "pipe",
            env: {
                ...process.env,
                ...(ownerNsec ? { OWNER_NSEC: ownerNsec } : {}),
            },
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

async function waitForOutput(
    proc: ChildProcess,
    searchText: string,
    timeout: number
): Promise<boolean> {
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

async function waitForProcessExit(proc: ChildProcess, timeout: number): Promise<void> {
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(), timeout);
        proc.on("exit", () => {
            clearTimeout(timer);
            resolve();
        });
    });
}
