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
// Use local/test relays instead of public ones to avoid rate limiting
const TEST_RELAYS = process.env.TEST_RELAYS
    ? process.env.TEST_RELAYS.split(",")
    : ["wss://relay.damus.io", "wss://relay.nostr.band"];
const TEST_TIMEOUT = 120000; // 120 seconds for comprehensive e2e tests
const PUBLISH_RETRY_ATTEMPTS = 3;
const PUBLISH_RETRY_DELAY = 2000; // 2 seconds between retries

// Global for helper functions
let globalNdk: NDK;

// Helper function to publish events with retry logic
async function publishWithRetry(
    event: NDKEvent,
    maxAttempts = PUBLISH_RETRY_ATTEMPTS
): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await event.publish();
            return; // Success
        } catch (error: any) {
            console.warn(`Publish attempt ${attempt} failed:`, error.message);
            if (attempt < maxAttempts) {
                console.log(`Retrying in ${PUBLISH_RETRY_DELAY}ms...`);
                await new Promise((resolve) => setTimeout(resolve, PUBLISH_RETRY_DELAY));
            } else {
                throw new Error(
                    `Failed to publish after ${maxAttempts} attempts: ${error.message}`
                );
            }
        }
    }
}

describe("TENEX Complete Workflow E2E Tests", () => {
    let daemonProcess: ChildProcess | null = null;
    const projectRunProcess: ChildProcess | null = null;
    let ownerNsec: string;
    let ownerPubkey: string;
    let ndk: NDK;

    beforeAll(async () => {
        // Setup test directory
        await fs.mkdir(TEST_DIR, { recursive: true });

        // Generate owner keys
        const signer = NDKPrivateKeySigner.generate();
        ownerNsec = signer.privateKey!;
        ownerPubkey = await signer.user().then((user) => user.pubkey);

        // Setup NDK
        ndk = new NDK({
            explicitRelayUrls: TEST_RELAYS,
            signer,
        });
        await ndk.connect();
        globalNdk = ndk;

        console.log("Test setup complete");
        console.log(`Owner pubkey: ${ownerPubkey}`);
    });

    afterAll(async () => {
        // Stop all processes
        if (daemonProcess) {
            console.log("Stopping daemon process...");
            daemonProcess.kill("SIGTERM");
            await waitForProcessExit(daemonProcess, 5000);
        }
        if (projectRunProcess) {
            console.log("Stopping project run process...");
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

    describe("Web Client → CLI → Daemon → Agents Workflow", () => {
        test(
            "should complete full workflow from project creation to agent collaboration",
            async () => {
                // Step 1: Simulate web client creating a project
                console.log("\n=== Step 1: Creating project via Nostr (simulating web client) ===");
                const projectIdentifier = `test-project-${Date.now()}`;
                const projectEvent = new NDKArticle(ndk);
                projectEvent.kind = EVENT_KINDS.PROJECT;
                projectEvent.dTag = projectIdentifier;
                projectEvent.title = "Full Workflow Test Project";
                projectEvent.content = "A comprehensive test of TENEX workflow";
                projectEvent.tags.push(
                    ["title", "Full Workflow Test Project"],
                    ["hashtag", "test"],
                    ["hashtag", "e2e"]
                );

                await projectEvent.sign();
                await publishWithRetry(projectEvent);

                const projectNaddr = projectEvent.encode();
                console.log(`Project created with naddr: ${projectNaddr}`);

                // Wait for event to propagate
                await new Promise((resolve) => setTimeout(resolve, 3000));

                // Step 2: Start daemon with owner pubkey whitelisted
                console.log("\n=== Step 2: Starting daemon ===");
                daemonProcess = spawnCommand(["daemon", "--whitelist", ownerPubkey]);

                const daemonStarted = await waitForOutput(
                    daemonProcess,
                    "TENEX daemon is running",
                    15000
                );
                expect(daemonStarted).toBe(true);
                console.log("Daemon started successfully");

                // Give daemon time to fully initialize
                await new Promise((resolve) => setTimeout(resolve, 2000));

                // Step 3: Use CLI client to create a chat thread
                console.log("\n=== Step 3: Creating chat thread via CLI client ===");

                // First, we need to set up the environment for cli-client
                const _cliClientEnv = {
                    ...process.env,
                    NSEC: ownerNsec,
                    PROJECT_NADDR: projectNaddr,
                };

                // Create a thread event using NDK (simulating cli-client behavior)
                const threadEvent = new NDKEvent(ndk);
                threadEvent.kind = EVENT_KINDS.CHAT;
                threadEvent.content = "Hello agents! Let's build a calculator app.";
                threadEvent.tags.push(
                    ["title", "Build Calculator App"],
                    ["p", ownerPubkey] // Mention ourselves to create a thread
                );
                threadEvent.tag(projectEvent);

                await threadEvent.sign();
                await publishWithRetry(threadEvent);
                console.log(`Thread created: ${threadEvent.id}`);

                // Step 4: Wait for daemon to detect and process the event
                console.log("\n=== Step 4: Waiting for daemon to spawn project run ===");
                await new Promise((resolve) => setTimeout(resolve, 5000));

                // Verify project status events are being published
                const statusEvents = await fetchProjectStatusEvents(projectNaddr);
                expect(statusEvents.length).toBeGreaterThan(0);
                console.log(`Found ${statusEvents.length} project status events`);

                // Step 5: Create a task via Nostr
                console.log("\n=== Step 5: Creating task ===");
                const taskEvent = new NDKEvent(ndk);
                taskEvent.kind = EVENT_KINDS.TASK;
                taskEvent.content =
                    "Implement a basic calculator with add, subtract, multiply, and divide functions";
                taskEvent.tags.push(["title", "Implement Calculator"]);
                taskEvent.tag(projectEvent);

                await taskEvent.sign();
                await publishWithRetry(taskEvent);
                console.log(`Task created: ${taskEvent.id}`);

                // Step 6: Monitor agent activity
                console.log("\n=== Step 6: Monitoring agent activity ===");
                await new Promise((resolve) => setTimeout(resolve, 10000));

                // Check for agent messages
                const chatEvents = await fetchChatEvents(projectNaddr);
                const agentMessages = chatEvents.filter((event) => event.pubkey !== ownerPubkey);
                expect(agentMessages.length).toBeGreaterThan(0);
                console.log(`Found ${agentMessages.length} agent messages`);

                // Check for status updates
                const statusUpdates = await fetchAgentStatusUpdates(projectNaddr);
                expect(statusUpdates.length).toBeGreaterThan(0);
                console.log(`Found ${statusUpdates.length} status updates`);

                // Step 7: Send a follow-up message
                console.log("\n=== Step 7: Sending follow-up message ===");
                const followUpEvent = new NDKEvent(ndk);
                followUpEvent.kind = EVENT_KINDS.CHAT_REPLY;
                followUpEvent.content = "Great work! Can you also add a square root function?";
                followUpEvent.tags.push(["e", threadEvent.id, "", "root"]);
                followUpEvent.tag(projectEvent);

                await followUpEvent.sign();
                await publishWithRetry(followUpEvent);

                // Wait for agent response
                await new Promise((resolve) => setTimeout(resolve, 5000));

                // Verify agents responded to follow-up
                const updatedChatEvents = await fetchChatEvents(projectNaddr);
                const followUpResponses = updatedChatEvents.filter(
                    (event) =>
                        event.pubkey !== ownerPubkey &&
                        event.created_at! > followUpEvent.created_at!
                );
                expect(followUpResponses.length).toBeGreaterThan(0);

                console.log("\n=== Workflow completed successfully! ===");
            },
            TEST_TIMEOUT
        );
    });

    describe("Multi-Agent Task Distribution", () => {
        test(
            "should distribute complex tasks across multiple agents",
            async () => {
                console.log("\n=== Testing Multi-Agent Task Distribution ===");

                // Create a project with multiple agent requirements
                const projectIdentifier = `multi-agent-${Date.now()}`;
                const projectEvent = new NDKArticle(ndk);
                projectEvent.kind = EVENT_KINDS.PROJECT;
                projectEvent.dTag = projectIdentifier;
                projectEvent.title = "Multi-Agent Test Project";
                projectEvent.content = "Testing complex multi-agent scenarios";
                projectEvent.tags.push(["title", "Multi-Agent Test Project"]);

                await projectEvent.sign();
                await publishWithRetry(projectEvent);

                const projectNaddr = projectEvent.encode();

                // Wait for event propagation
                await new Promise((resolve) => setTimeout(resolve, 2000));

                // Create a complex task that requires multiple agents
                const complexTaskEvent = new NDKEvent(ndk);
                complexTaskEvent.kind = EVENT_KINDS.TASK;
                complexTaskEvent.content = `Create a complete web application with:
                    1. User authentication system
                    2. REST API endpoints
                    3. Database schema
                    4. Frontend UI components
                    5. Comprehensive test suite`;
                complexTaskEvent.tags.push(["title", "Build Complete Web App"]);
                complexTaskEvent.tag(projectEvent);

                await complexTaskEvent.sign();
                await publishWithRetry(complexTaskEvent);

                // Give agents time to process and collaborate
                console.log("Waiting for agents to collaborate...");
                await new Promise((resolve) => setTimeout(resolve, 15000));

                // Verify multiple agents participated
                const statusUpdates = await fetchAgentStatusUpdates(projectNaddr);
                const agentNames = new Set<string>();

                statusUpdates.forEach((event) => {
                    try {
                        const content = JSON.parse(event.content);
                        if (content.agent_name) {
                            agentNames.add(content.agent_name);
                        }
                    } catch {
                        // Ignore parsing errors
                    }
                });

                console.log(`Agents that participated: ${Array.from(agentNames).join(", ")}`);
                expect(agentNames.size).toBeGreaterThanOrEqual(2);
            },
            TEST_TIMEOUT
        );
    });

    describe("Error Handling and Recovery", () => {
        test(
            "should handle missing project gracefully",
            async () => {
                console.log("\n=== Testing Error Handling ===");

                // Create an event for a non-existent project
                const fakeProjectIdentifier = `fake-project-${Date.now()}`;
                const fakeProjectEvent = {
                    tagId: () => `31933:${ownerPubkey}:${fakeProjectIdentifier}`,
                } as any;
                const chatEvent = new NDKEvent(ndk);
                chatEvent.kind = EVENT_KINDS.CHAT;
                chatEvent.content = "Hello to a non-existent project";
                chatEvent.tag(fakeProjectEvent);

                await chatEvent.sign();
                await publishWithRetry(chatEvent);

                // Wait to see if daemon handles it gracefully
                await new Promise((resolve) => setTimeout(resolve, 5000));

                // Daemon should continue running
                expect(daemonProcess?.killed).toBe(false);
                console.log("Daemon handled missing project gracefully");
            },
            TEST_TIMEOUT
        );
    });
});

// Helper functions
// runCommand is not currently used but kept for potential future use
// async function runCommand(
//     args: string[]
// ): Promise<{ code: number | null; stdout: string; stderr: string }> {
//     return new Promise((resolve) => {
//         const proc = spawn("bun", ["run", CLI_PATH, ...args], {
//             cwd: process.cwd(),
//             stdio: "pipe",
//         });
//
//         let stdout = "";
//         let stderr = "";
//
//         proc.stdout?.on("data", (data) => {
//             stdout += data.toString();
//         });
//
//         proc.stderr?.on("data", (data) => {
//             stderr += data.toString();
//         });
//
//         proc.on("close", (code) => {
//             resolve({ code, stdout, stderr });
//         });
//     });
// }

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
