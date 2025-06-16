import { afterAll, beforeAll, describe, expect, test } from "bun:test";
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
const TEST_TIMEOUT = 90000; // 90 seconds

describe("CLI Client Integration Tests", () => {
    let daemonProcess: ChildProcess | null = null;
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
    });

    afterAll(async () => {
        // Stop daemon
        if (daemonProcess) {
            daemonProcess.kill("SIGTERM");
            await waitForProcessExit(daemonProcess, 5000);
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

    describe("CLI Client → Daemon → Agent Flow", () => {
        test(
            "should create project via CLI client and interact with agents",
            async () => {
                // Step 1: Start daemon
                console.log("Starting daemon...");
                daemonProcess = spawn(
                    "bun",
                    ["run", CLI_PATH, "daemon", "--whitelist", ownerPubkey],
                    {
                        cwd: process.cwd(),
                        stdio: "pipe",
                    }
                );

                const daemonStarted = await waitForOutput(
                    daemonProcess,
                    "TENEX daemon is running",
                    15000
                );
                expect(daemonStarted).toBe(true);

                // Step 2: Build cli-client if needed
                console.log("Building cli-client...");
                const buildResult = await runCommandInDir(
                    ["bun", "run", "build"],
                    path.join(process.cwd(), "../cli-client")
                );
                expect(buildResult.code).toBe(0);

                // Step 3: Use cli-client to create a project
                console.log("Creating project via cli-client...");

                // First create a simple script that uses cli-client programmatically
                const testScript = `
                    import { ProjectCreator } from "${path.join(process.cwd(), "../cli-client/src/create-project.js")}";
                    import { getNDK } from "${path.join(process.cwd(), "../cli-client/src/ndk-setup.js")}";
                    
                    const nsec = "${ownerNsec}";
                    const ndk = await getNDK({ nsec });
                    
                    const creator = new ProjectCreator(ndk);
                    const projectEvent = await creator.createProjectEvent({
                        title: "CLI Client Test Project",
                        description: "Testing CLI client integration",
                        hashtags: ["test", "cli"],
                        gitRepo: ""
                    });
                    
                    console.log("PROJECT_CREATED:" + projectEvent.encode());
                `;

                const scriptPath = path.join(TEST_DIR, "create-project.ts");
                await fs.writeFile(scriptPath, testScript);

                const createResult = await runCommand(["bun", "run", scriptPath]);
                expect(createResult.code).toBe(0);

                // Extract project naddr from output
                const naddrMatch = createResult.stdout.match(
                    /PROJECT_CREATED:(naddr1[a-zA-Z0-9]+)/
                );
                expect(naddrMatch).toBeTruthy();
                const projectNaddr = naddrMatch![1];

                console.log(`Project created with naddr: ${projectNaddr}`);

                // Wait for propagation
                await new Promise((resolve) => setTimeout(resolve, 3000));

                // Step 4: Create a chat message using cli-client approach
                console.log("Creating chat thread...");

                const chatScript = `
                    import { TenexChat } from "${path.join(process.cwd(), "../cli-client/src/chat.js")}";
                    import { getNDK } from "${path.join(process.cwd(), "../cli-client/src/ndk-setup.js")}";
                    import { nip19 } from "nostr-tools";
                    
                    const nsec = "${ownerNsec}";
                    const ndk = await getNDK({ nsec });
                    
                    // Decode project info
                    const decoded = nip19.decode("${projectNaddr}");
                    if (decoded.type !== "naddr") throw new Error("Invalid naddr");
                    
                    const project = {
                        naddr: "${projectNaddr}",
                        pubkey: decoded.data.pubkey,
                        identifier: decoded.data.identifier,
                        title: "CLI Client Test Project"
                    };
                    
                    const chat = new TenexChat(ndk, project);
                    const threadEvent = await chat.createThread(
                        "Test Thread",
                        "Hello agents! Please help me build a simple counter app.",
                        []
                    );
                    
                    console.log("THREAD_CREATED:" + threadEvent.id);
                `;

                const chatScriptPath = path.join(TEST_DIR, "create-chat.ts");
                await fs.writeFile(chatScriptPath, chatScript);

                const chatResult = await runCommand(["bun", "run", chatScriptPath]);
                expect(chatResult.code).toBe(0);

                const threadMatch = chatResult.stdout.match(/THREAD_CREATED:([a-f0-9]+)/);
                expect(threadMatch).toBeTruthy();
                const threadId = threadMatch![1];

                console.log(`Thread created: ${threadId}`);

                // Step 5: Wait for daemon to process and agents to respond
                console.log("Waiting for agent responses...");
                await new Promise((resolve) => setTimeout(resolve, 10000));

                // Step 6: Verify agent activity
                const decoded = nip19.decode(projectNaddr);
                if (decoded.type !== "naddr") throw new Error("Invalid naddr");

                const filter = {
                    kinds: [11, 1111],
                    "#a": [`31933:${decoded.data.pubkey}:${decoded.data.identifier}`],
                    since: Math.floor(Date.now() / 1000) - 300,
                };

                const events = await ndk.fetchEvents(filter, { closeOnEose: true });
                const chatEvents = Array.from(events);

                // Find agent responses
                const agentMessages = chatEvents.filter((event) => event.pubkey !== ownerPubkey);
                expect(agentMessages.length).toBeGreaterThan(0);

                console.log(`Found ${agentMessages.length} agent responses`);

                // Step 7: Test typing indicators
                console.log("Checking for typing indicators...");

                const typingFilter = {
                    kinds: [24111, 24112],
                    "#e": [threadId],
                    since: Math.floor(Date.now() / 1000) - 300,
                };

                const typingEvents = await ndk.fetchEvents(typingFilter, { closeOnEose: true });
                expect(typingEvents.size).toBeGreaterThan(0);

                console.log(`Found ${typingEvents.size} typing indicator events`);
            },
            TEST_TIMEOUT
        );
    });

    describe("CLI Client Error Handling", () => {
        test("should handle invalid project naddr gracefully", async () => {
            const invalidScript = `
                    import { TenexChat } from "${path.join(process.cwd(), "../cli-client/src/chat.js")}";
                    import { getNDK } from "${path.join(process.cwd(), "../cli-client/src/ndk-setup.js")}";
                    
                    const nsec = "${ownerNsec}";
                    const ndk = await getNDK({ nsec });
                    
                    try {
                        const projectEvent = await ndk.fetchEvent("naddr1invalid");
                        console.log("Should not reach here");
                    } catch (error) {
                        console.log("ERROR_HANDLED:Invalid naddr");
                    }
                `;

            const errorScriptPath = path.join(TEST_DIR, "error-test.ts");
            await fs.writeFile(errorScriptPath, invalidScript);

            const result = await runCommand(["bun", "run", errorScriptPath]);
            expect(result.stdout).toContain("ERROR_HANDLED");
        }, 30000);
    });
});

// Helper functions
async function runCommand(
    args: string[]
): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
        const proc = spawn(args[0], args.slice(1), {
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

async function runCommandInDir(
    args: string[],
    cwd: string
): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
        const proc = spawn(args[0], args.slice(1), {
            cwd,
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
