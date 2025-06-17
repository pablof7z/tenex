import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import NDK, { NDKEvent, NDKPrivateKeySigner, NDKArticle } from "@nostr-dev-kit/ndk";
import { EVENT_KINDS } from "@tenex/types/events";
import { nip19 } from "nostr-tools";

const CLI_PATH = path.join(__dirname, "../../bin/tenex.ts");
const _CLI_CLIENT_PATH = path.join(__dirname, "../../../cli-client/dist/index.js");
const TEST_DIR = path.join(process.cwd(), "test-e2e-temp");

// Test configuration
const TEST_RELAYS = ["wss://relay.damus.io", "wss://nos.lol"];
const TEST_TIMEOUT = 60000; // 60 seconds for e2e tests

// Global for helper functions
let globalNdk: NDK;

describe("TENEX End-to-End Tests", () => {
    let daemonProcess: ChildProcess | null = null;
    const projectRunProcess: ChildProcess | null = null;
    let testProjectNaddr: string;
    let testProjectPath: string;
    let _ownerNsec: string;
    let ownerPubkey: string;
    let ndk: NDK;

    beforeAll(async () => {
        // Setup test directory
        await fs.mkdir(TEST_DIR, { recursive: true });

        // Generate owner keys
        const signer = NDKPrivateKeySigner.generate();
        _ownerNsec = signer.privateKey!;
        ownerPubkey = await signer.user().then((user) => user.pubkey);

        // Setup NDK
        ndk = new NDK({
            explicitRelayUrls: TEST_RELAYS,
            signer,
        });
        await ndk.connect();
        globalNdk = ndk; // Set global for helper functions
    });

    afterAll(async () => {
        // Stop all processes
        if (daemonProcess) {
            daemonProcess.kill("SIGTERM");
            await waitForProcessExit(daemonProcess, 5000);
        }
        if (projectRunProcess) {
            projectRunProcess.kill("SIGTERM");
            await waitForProcessExit(projectRunProcess, 5000);
        }

        // Disconnect NDK
        if (ndk?.pool?.relays) {
            for (const relay of ndk.pool.relays.values()) {
                relay.disconnect();
            }
        }

        // Clean up test directory
        await fs.rm(TEST_DIR, { recursive: true, force: true });
    });

    describe("Complete Project Flow", () => {
        test(
            "should create project, start daemon, and handle tasks",
            async () => {
                // Step 1: Create project directly via Nostr
                console.log("Creating project...");
                const projectIdentifier = `test-project-${Date.now()}`;
                const projectEvent = new NDKArticle(ndk);
                projectEvent.kind = EVENT_KINDS.PROJECT;
                projectEvent.dTag = projectIdentifier;
                projectEvent.title = "E2E Test Project";
                projectEvent.content = "Testing TENEX end-to-end flow";
                projectEvent.tags.push(
                    ["title", "E2E Test Project"]
                    // No repo tag - let it create without cloning
                );

                await projectEvent.sign();
                await projectEvent.publish();

                testProjectNaddr = projectEvent.encode();
                console.log(`Project created with naddr: ${testProjectNaddr}`);

                // Wait for event to propagate to relays
                console.log("Waiting for event propagation...");
                await new Promise((resolve) => setTimeout(resolve, 3000));

                // Step 2: Start daemon with owner pubkey whitelisted
                console.log("Starting daemon...");
                daemonProcess = spawnCommand(["daemon", "--whitelist", ownerPubkey]);

                const daemonStarted = await waitForOutput(
                    daemonProcess,
                    "TENEX daemon is running",
                    10000
                );
                expect(daemonStarted).toBe(true);

                // Give daemon time to fully initialize
                await new Promise((resolve) => setTimeout(resolve, 2000));

                // Step 3: Initialize project locally
                testProjectPath = path.join(TEST_DIR, "test-project");
                console.log(`Initializing project at ${testProjectPath}...`);

                const initResult = await runCommand([
                    "project",
                    "init",
                    testProjectPath,
                    testProjectNaddr,
                ]);
                expect(initResult.code).toBe(0);

                // Step 4: Create a task directly via Nostr
                console.log("Creating task...");
                const taskEvent = new NDKEvent(ndk);
                taskEvent.kind = EVENT_KINDS.TASK;
                taskEvent.content = "Please create a hello world function";
                taskEvent.tags.push(["title", "Test Task"]);
                taskEvent.tag(projectEvent);

                await taskEvent.sign();
                await taskEvent.publish();
                console.log("Task created:", taskEvent.id);

                // Step 5: Wait for daemon to spawn project run
                console.log("Waiting for project to start...");
                await new Promise((resolve) => setTimeout(resolve, 5000));

                // Step 6: Verify project is processing events
                console.log("Checking project status...");
                const statusEvents = await fetchProjectStatusEvents(testProjectNaddr);
                expect(statusEvents.length).toBeGreaterThan(0);

                // Step 7: Send a chat message directly via Nostr
                console.log("Sending chat message...");
                const chatEvent = new NDKEvent(ndk);
                chatEvent.kind = EVENT_KINDS.CHAT;
                chatEvent.content = "Hello, agent! How are you?";
                chatEvent.tag(projectEvent);

                await chatEvent.sign();
                await chatEvent.publish();
                console.log("Chat message sent:", chatEvent.id);

                // Step 8: Wait for agent response
                console.log("Waiting for agent response...");
                await new Promise((resolve) => setTimeout(resolve, 3000));

                // Step 9: Fetch chat messages
                const chatEvents = await fetchChatEvents(testProjectNaddr);
                expect(chatEvents.length).toBeGreaterThan(0);

                // Find agent responses
                const agentMessages = chatEvents.filter((event) => event.pubkey !== ownerPubkey);
                expect(agentMessages.length).toBeGreaterThan(0);

                console.log("E2E test completed successfully!");
            },
            TEST_TIMEOUT
        );
    });

    describe("Multi-Agent Collaboration", () => {
        test(
            "should handle multiple agents working together",
            async () => {
                // Create a project with multiple agents
                console.log("Creating multi-agent project...");
                const projectIdentifier = `multi-agent-${Date.now()}`;
                const projectEvent = new NDKArticle(ndk);
                projectEvent.kind = EVENT_KINDS.PROJECT;
                projectEvent.dTag = projectIdentifier;
                projectEvent.title = "Multi-Agent Test";
                projectEvent.content = "Testing multi-agent collaboration";
                projectEvent.tags.push(
                    ["title", "Multi-Agent Test"]
                    // No repo tag - let it create without cloning
                );

                await projectEvent.sign();
                await projectEvent.publish();

                const multiAgentNaddr = projectEvent.encode();

                // Wait for event to propagate
                await new Promise((resolve) => setTimeout(resolve, 2000));

                // Initialize the project
                const projectPath = path.join(TEST_DIR, "multi-agent-project");
                await runCommand(["project", "init", projectPath, multiAgentNaddr]);

                // Create a complex task that requires multiple agents
                console.log("Creating complex task...");
                const taskEvent = new NDKEvent(ndk);
                taskEvent.kind = EVENT_KINDS.TASK;
                taskEvent.content = "Create a user authentication system with tests";
                taskEvent.tags.push(["title", "Build Feature"]);
                taskEvent.tag(multiAgentProject);

                await taskEvent.sign();
                await taskEvent.publish();

                // Wait for agents to collaborate
                await new Promise((resolve) => setTimeout(resolve, 10000));

                // Check for status updates from different agents
                const statusUpdates = await fetchAgentStatusUpdates(multiAgentNaddr);

                // Verify multiple agents participated
                const uniqueAgents = new Set(
                    statusUpdates.map((event) => {
                        const agentTag = event.tags.find((t) => t[0] === "agent");
                        return agentTag ? agentTag[1] : null;
                    })
                );

                expect(uniqueAgents.size).toBeGreaterThan(1);
                console.log(`${uniqueAgents.size} agents collaborated on the task`);
            },
            TEST_TIMEOUT
        );
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

function spawnCommand(args: string[]) {
    return spawn("bun", ["run", CLI_PATH, ...args], {
        cwd: process.cwd(),
        stdio: "pipe",
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
            console.log(`[Process Output] ${text.trim()}`);
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

async function fetchProjectStatusEvents(projectNaddr: string): Promise<NDKEvent[]> {
    const decoded = nip19.decode(projectNaddr);
    if (decoded.type !== "naddr") throw new Error("Invalid naddr");

    const filter = {
        kinds: [24010],
        "#a": [`31933:${decoded.data.pubkey}:${decoded.data.identifier}`],
        since: Math.floor(Date.now() / 1000) - 300, // Last 5 minutes
    };

    const events = await globalNdk.fetchEvents(filter, { closeOnEose: true });
    return Array.from(events);
}

async function fetchChatEvents(projectNaddr: string): Promise<NDKEvent[]> {
    const decoded = nip19.decode(projectNaddr);
    if (decoded.type !== "naddr") throw new Error("Invalid naddr");

    const filter = {
        kinds: [11, 1111],
        "#a": [`31933:${decoded.data.pubkey}:${decoded.data.identifier}`],
        since: Math.floor(Date.now() / 1000) - 300,
    };

    const events = await globalNdk.fetchEvents(filter, { closeOnEose: true });
    return Array.from(events).sort((a, b) => a.created_at! - b.created_at!);
}

async function fetchAgentStatusUpdates(projectNaddr: string): Promise<NDKEvent[]> {
    const decoded = nip19.decode(projectNaddr);
    if (decoded.type !== "naddr") throw new Error("Invalid naddr");

    const filter = {
        kinds: [1],
        "#a": [`31933:${decoded.data.pubkey}:${decoded.data.identifier}`],
        "#t": ["status-update"],
        since: Math.floor(Date.now() / 1000) - 300,
    };

    const events = await globalNdk.fetchEvents(filter, { closeOnEose: true });
    return Array.from(events);
}
