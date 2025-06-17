#!/usr/bin/env bun

import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import NDK, { NDKPrivateKeySigner, type NDKSubscription } from "@nostr-dev-kit/ndk";

const TENEX_PATH = path.join(__dirname, "..", "tenex", "bin", "tenex.ts");
const CLI_CLIENT_PATH = path.join(__dirname, "..", "cli-client", "dist", "index.js");
const _TEST_TIMEOUT = 90000; // 90 seconds

interface ProcessInfo {
    process: ChildProcess;
    output: string[];
    errors: string[];
}

interface StatusEventData {
    status: string;
    timestamp: number;
    project: string;
    llmConfigs?: string[];
}

async function runCommand(
    command: string,
    args: string[],
    options?: { cwd?: string }
): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, options);
        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
            stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
            stderr += data.toString();
        });

        child.on("close", (code) => {
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                reject(new Error(`Command failed with code ${code}: ${stderr}`));
            }
        });

        child.on("error", (error) => {
            reject(error);
        });
    });
}

function startProcess(command: string, args: string[]): ProcessInfo {
    const child = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, FORCE_COLOR: "0" },
    });

    const info: ProcessInfo = {
        process: child,
        output: [],
        errors: [],
    };

    child.stdout?.on("data", (data) => {
        const lines = data.toString().split("\n").filter(Boolean);
        info.output.push(...lines);
        console.log(`[${path.basename(command)}]`, data.toString().trim());
    });

    child.stderr?.on("data", (data) => {
        const lines = data.toString().split("\n").filter(Boolean);
        info.errors.push(...lines);
        console.error(`[${path.basename(command)} ERROR]`, data.toString().trim());
    });

    return info;
}

async function waitForCondition(
    check: () => boolean | Promise<boolean>,
    timeout = 10000,
    interval = 100
): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        if (await check()) {
            return;
        }
        await setTimeout(interval);
    }
    throw new Error(`Condition not met within ${timeout}ms`);
}

async function killProcessTree(pid: number): Promise<void> {
    try {
        process.kill(pid, "SIGTERM");
        await setTimeout(2000);

        try {
            process.kill(pid, "SIGKILL");
        } catch (_err) {
            // Process already dead, ignore
        }
    } catch (_err) {
        // Process might already be dead
    }
}

async function cleanup(daemon?: ProcessInfo) {
    console.log("\n🧹 Cleaning up processes...");

    if (daemon?.process?.pid) {
        await killProcessTree(daemon.process.pid);
    }

    await setTimeout(1000);
}

async function buildCliClient() {
    console.log("🔨 Building cli-client...");
    await runCommand("bun", ["run", "build"], {
        cwd: path.join(__dirname, "..", "cli-client"),
    });
    console.log("✅ CLI client built successfully");
}

async function createMockLLMConfig(projectPath: string): Promise<void> {
    const llmConfigPath = path.join(projectPath, ".tenex", "llms.json");

    // Create a simple mock config that won't trigger API calls
    const mockConfig = {
        "mock-gpt-4": {
            provider: "mock",
            model: "gpt-4",
            apiKey: "mock-key-123",
            enableCaching: false,
        },
        "mock-claude-sonnet": {
            provider: "mock",
            model: "claude-3-sonnet-20240229",
            apiKey: "mock-key-456",
            enableCaching: true,
        },
        "mock-gemma": {
            provider: "mock",
            model: "gemma:7b",
            enableCaching: false,
        },
        default: "mock-gpt-4",
    };

    await fs.writeFile(llmConfigPath, JSON.stringify(mockConfig, null, 2));
    console.log(`✅ Created mock LLM config at ${llmConfigPath}`);
}

async function setupNDKListener(
    userSigner: NDKPrivateKeySigner,
    projectNaddr: string
): Promise<{
    ndk: NDK;
    subscription: NDKSubscription;
    capturedEvent: Promise<{ content: StatusEventData; tags: string[][] }>;
}> {
    const ndk = new NDK({
        explicitRelayUrls: ["wss://relay.damus.io", "wss://relay.primal.net"],
        signer: userSigner,
    });

    await ndk.connect();

    let resolveEvent: (value: { content: StatusEventData; tags: string[][] }) => void;
    const capturedEvent = new Promise<{ content: StatusEventData; tags: string[][] }>((resolve) => {
        resolveEvent = resolve;
    });

    const subscription = ndk.subscribe({
        kinds: [24010], // Status event kind
        "#a": [projectNaddr.replace("naddr1", "31933:")],
    });

    subscription.on("event", (event) => {
        try {
            const content = JSON.parse(event.content) as StatusEventData;
            console.log(`📡 Received status event: ${JSON.stringify(content)}`);
            console.log(`🏷️  Event tags: ${JSON.stringify(event.tags)}`);

            resolveEvent({ content, tags: event.tags });
        } catch (err) {
            console.error("Failed to parse status event:", err);
        }
    });

    return { ndk, subscription, capturedEvent };
}

function findProjectPath(projectName: string): string {
    const projectsDir = path.join(__dirname, "projects");
    const entries = require("node:fs").readdirSync(projectsDir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isDirectory()) {
            const metadataPath = path.join(projectsDir, entry.name, ".tenex", "metadata.json");
            try {
                const metadata = JSON.parse(require("node:fs").readFileSync(metadataPath, "utf8"));
                if (metadata.title === projectName) {
                    return path.join(projectsDir, entry.name);
                }
            } catch (_err) {}
        }
    }

    throw new Error(`Project with name "${projectName}" not found in ${projectsDir}`);
}

async function runStatusEventTest() {
    console.log("🚀 Starting Status Event Validation Test");

    let daemon: ProcessInfo | undefined;
    let ndk: NDK | undefined;
    let subscription: NDKSubscription | undefined;

    try {
        // Build cli-client first
        await buildCliClient();

        // 1. Generate new Nostr key
        const signer = NDKPrivateKeySigner.generate();
        const pubkey = signer.pubkey;
        const nsec = signer.privateKey!;

        console.log(`\n📝 Generated new user with pubkey: ${pubkey}`);

        // 2. Create project via cli-client
        const _randomNum = Math.floor(Math.random() * 900000) + 100000;
        const projectName = "Status Test Project";

        console.log(`\n📦 Creating project: ${projectName}`);

        const createResult = await runCommand("bun", [
            CLI_CLIENT_PATH,
            "project",
            "create",
            "--name",
            projectName,
            "--nsec",
            nsec,
            "--description",
            "Status event validation test project",
            "--hashtags",
            "test,status,validation",
        ]);

        // Extract NADDR from output
        const naddrMatch = createResult.stdout.match(/NADDR: (naddr1[a-zA-Z0-9]+)/);
        if (!naddrMatch) {
            throw new Error("Failed to extract NADDR from project creation output");
        }
        const projectNaddr = naddrMatch[1];
        console.log(`✅ Project created with NADDR: ${projectNaddr}`);

        // 3. Start daemon with the new user's pubkey as whitelist
        console.log("\n🎯 Starting daemon with whitelisted pubkey...");
        daemon = startProcess("bun", [TENEX_PATH, "daemon", "--whitelist", pubkey]);

        // Wait for daemon to be ready
        await waitForCondition(
            () =>
                daemon!.output.some(
                    (line) =>
                        line.includes("daemon is running") ||
                        line.includes("Event monitor started") ||
                        line.includes("Monitoring events")
                ),
            15000
        );
        console.log("✅ Daemon started successfully");

        // 4. Send project start event to initialize project locally
        console.log("\n📡 Sending project start event...");
        await runCommand("bun", [
            CLI_CLIENT_PATH,
            "project",
            "start",
            "--nsec",
            nsec,
            "--project",
            projectNaddr,
        ]);

        // Wait for daemon to start the project
        await waitForCondition(
            () =>
                daemon!.output.some(
                    (line) => line.includes("Starting tenex run") || line.includes("spawning")
                ),
            20000
        );
        console.log("✅ Project initialized locally");

        // 5. Find project directory and add LLM configs
        console.log("\n🔍 Finding project directory...");
        await setTimeout(2000);

        const projectPath = findProjectPath(projectName);
        console.log(`✅ Found project at: ${projectPath}`);

        // Kill the project process to add LLM configs
        console.log("\n💀 Stopping project to add LLM configs...");
        await runCommand("pkill", ["-f", `tenex.*run.*${path.basename(projectPath)}`]).catch(
            () => {}
        );
        await setTimeout(3000);

        // 6. Add mock LLM configurations
        console.log("\n⚙️ Adding mock LLM configurations...");
        await createMockLLMConfig(projectPath);

        // 7. Set up NDK listener for status events BEFORE restarting
        console.log("\n👂 Setting up Nostr listener for status events...");
        const {
            ndk: ndkInstance,
            subscription: sub,
            capturedEvent,
        } = await setupNDKListener(signer, projectNaddr);
        ndk = ndkInstance;
        subscription = sub;

        // 8. Restart the project
        console.log("\n🔄 Restarting project...");
        await runCommand("bun", [
            CLI_CLIENT_PATH,
            "project",
            "start",
            "--nsec",
            nsec,
            "--project",
            projectNaddr,
        ]);

        // Wait for daemon to start the project again
        await waitForCondition(
            () =>
                daemon!.output.some(
                    (line) => line.includes("Starting tenex run") || line.includes("spawning")
                ),
            20000
        );

        // Wait for project to come online
        await waitForCondition(
            () =>
                daemon!.output.some(
                    (line) =>
                        line.includes('"status":"online"') || line.includes("Publishing status")
                ),
            30000
        );

        console.log("✅ Project restarted and online");

        // 9. Wait for and validate the status event
        console.log("\n⏳ Waiting for status event...");

        const { content: statusContent, tags: statusTags } = await Promise.race([
            capturedEvent,
            setTimeout(30000).then(() => {
                throw new Error("Timeout waiting for status event");
            }),
        ]);

        // 10. Validate the status event
        console.log("\n🔍 Validating status event...");

        // Check content
        if (!statusContent || statusContent.status !== "online") {
            throw new Error(`Invalid status content: ${JSON.stringify(statusContent)}`);
        }

        if (!statusContent.llmConfigs || !Array.isArray(statusContent.llmConfigs)) {
            throw new Error(`Missing llmConfigs in status: ${JSON.stringify(statusContent)}`);
        }

        // Check LLM configs
        const expectedLLMs = ["mock-gpt-4", "mock-claude-sonnet", "mock-gemma"];
        const actualLLMs = statusContent.llmConfigs;

        for (const expectedLLM of expectedLLMs) {
            if (!actualLLMs.includes(expectedLLM)) {
                throw new Error(
                    `Missing expected LLM "${expectedLLM}". Got: ${JSON.stringify(actualLLMs)}`
                );
            }
        }

        // Check tags
        const modelTags = statusTags.filter((tag) => tag[0] === "model");
        const agentTags = statusTags.filter((tag) => tag[0] === "p");

        if (modelTags.length === 0) {
            throw new Error("No model tags found in status event");
        }

        if (agentTags.length === 0) {
            throw new Error("No agent tags found in status event");
        }

        // Validate model tags contain expected models
        const modelNames = modelTags.map((tag) => tag[1]);
        const expectedModelNames = ["gpt-4", "claude-3-sonnet-20240229", "gemma:7b"];

        for (const expectedModel of expectedModelNames) {
            if (!modelNames.includes(expectedModel)) {
                throw new Error(
                    `Missing expected model "${expectedModel}" in tags. Got: ${JSON.stringify(modelNames)}`
                );
            }
        }

        console.log("✅ Status event validation passed:");
        console.log(`   - Status: ${statusContent.status}`);
        console.log(`   - Project: ${statusContent.project}`);
        console.log(`   - LLM Configs: ${JSON.stringify(statusContent.llmConfigs)}`);
        console.log(`   - Model Tags: ${modelTags.length} tags (${modelNames.join(", ")})`);
        console.log(`   - Agent Tags: ${agentTags.length} agents`);

        console.log("\n✨ Status Event Test Summary:");
        console.log("- ✅ Generated Nostr identity");
        console.log("- ✅ Created project via cli-client");
        console.log("- ✅ Started daemon and initialized project");
        console.log("- ✅ Added mock LLM configurations");
        console.log("- ✅ Set up Nostr event listener");
        console.log("- ✅ Restarted project and captured status event");
        console.log("- ✅ Validated LLM configs in event content");
        console.log("- ✅ Validated model tags in event");
        console.log("- ✅ Validated agent tags in event");

        console.log("\n🎉 Status event validation test completed successfully!");
    } catch (error) {
        console.error("\n❌ Status event test failed:", error);

        if (daemon) {
            console.log("\nLast daemon output:");
            console.log(daemon.output.slice(-10).join("\n"));
        }

        throw error;
    } finally {
        if (subscription) {
            subscription.stop();
        }
        if (ndk) {
            ndk.pool?.disconnect();
        }

        await cleanup(daemon);
    }
}

// Run the test
if (import.meta.main) {
    runStatusEventTest()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
