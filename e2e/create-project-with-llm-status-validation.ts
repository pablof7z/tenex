#!/usr/bin/env bun

import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import NDK, { NDKPrivateKeySigner, type NDKSubscription } from "@nostr-dev-kit/ndk";

const TENEX_PATH = path.join(__dirname, "..", "tenex", "bin", "tenex.ts");
const CLI_CLIENT_PATH = path.join(__dirname, "..", "cli-client", "dist", "index.js");

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

function startProcess(command: string, args: string[], options?: { cwd?: string }): ProcessInfo {
    const child = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, FORCE_COLOR: "0" },
        ...options,
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
        // Try graceful termination first
        process.kill(pid, "SIGTERM");
        await setTimeout(2000);

        // Force kill if still running
        try {
            process.kill(pid, "SIGKILL");
        } catch (_err) {
            // Process already dead, ignore
        }
    } catch (_err) {
        // Process might already be dead
    }
}

async function cleanup(tenexRunProcess?: ProcessInfo) {
    console.log("\n🧹 Cleaning up processes...");

    // Kill tenex run process
    if (tenexRunProcess?.process?.pid) {
        await killProcessTree(tenexRunProcess.process.pid);
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

    const mockConfig = {
        "mock-gpt-4": {
            provider: "openai",
            model: "gpt-4",
            apiKey: "mock-key-123",
            enableCaching: false,
        },
        "mock-claude-sonnet": {
            provider: "anthropic",
            model: "claude-3-sonnet-20240229",
            apiKey: "mock-key-456",
            enableCaching: true,
        },
        "mock-gemma": {
            provider: "ollama",
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

async function runE2ETest() {
    console.log(
        "🚀 Starting comprehensive E2E test for project creation with LLM status validation"
    );

    let tenexRunProcess: ProcessInfo | undefined;
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
        const randomNum = Math.floor(Math.random() * 900000) + 100000; // 6-digit random number
        const projectName = "LLM Status Test Project";

        console.log(`\n📦 Creating project: ${projectName} (test-llm-${randomNum})`);

        const createResult = await runCommand("bun", [
            CLI_CLIENT_PATH,
            "project",
            "create",
            "--name",
            projectName,
            "--nsec",
            nsec,
            "--description",
            "E2E test project for LLM status validation",
            "--hashtags",
            "test,e2e,llm-status",
        ]);

        // Extract NADDR from output
        const naddrMatch = createResult.stdout.match(/NADDR: (naddr1[a-zA-Z0-9]+)/);
        if (!naddrMatch) {
            throw new Error("Failed to extract NADDR from project creation output");
        }
        const projectNaddr = naddrMatch[1];
        console.log(`✅ Project created with NADDR: ${projectNaddr}`);

        // 3. Initialize project locally using tenex project init
        console.log("\n🔧 Initializing project locally...");
        const projectDir = path.join(__dirname, "projects", `test-llm-${randomNum}`);

        await runCommand("bun", [TENEX_PATH, "project", "init", projectDir, projectNaddr]);

        console.log(`✅ Project initialized at: ${projectDir}`);

        // 4. Add mock LLM configurations
        console.log("\n⚙️ Adding mock LLM configurations...");
        await createMockLLMConfig(projectDir);

        // 5. Set up NDK listener for status events BEFORE starting the project
        console.log("\n👂 Setting up Nostr listener for status events...");
        const {
            ndk: ndkInstance,
            subscription: sub,
            capturedEvent,
        } = await setupNDKListener(signer, projectNaddr);
        ndk = ndkInstance;
        subscription = sub;

        // 6. Start the project using tenex project run
        console.log("\n🚀 Starting project with tenex project run...");
        tenexRunProcess = startProcess("bun", [TENEX_PATH, "project", "run"], {
            cwd: projectDir,
        });

        // Wait for project to come online and publish status
        await waitForCondition(
            () =>
                tenexRunProcess!.output.some(
                    (line) =>
                        line.includes('"status":"online"') ||
                        line.includes("Publishing status") ||
                        line.includes("Project is now online")
                ),
            30000
        );

        console.log("✅ Project started and online");

        // 9. Wait for and validate the status event
        console.log("\n⏳ Waiting for status event with LLM and agent information...");

        const { content: statusContent, tags: statusTags } = await Promise.race([
            capturedEvent,
            setTimeout(30000).then(() => {
                throw new Error("Timeout waiting for status event");
            }),
        ]);

        // 10. Validate the status event content and tags
        console.log("\n🔍 Validating status event...");

        // Check content structure
        if (!statusContent || statusContent.status !== "online") {
            throw new Error(`Invalid status content: ${JSON.stringify(statusContent)}`);
        }

        if (!statusContent.llmConfigs || !Array.isArray(statusContent.llmConfigs)) {
            throw new Error(
                `Missing or invalid llmConfigs in status: ${JSON.stringify(statusContent)}`
            );
        }

        // Check that we have the expected LLM configs
        const expectedLLMs = ["mock-gpt-4", "mock-claude-sonnet", "mock-gemma"];
        const actualLLMs = statusContent.llmConfigs;

        for (const expectedLLM of expectedLLMs) {
            if (!actualLLMs.includes(expectedLLM)) {
                throw new Error(
                    `Missing expected LLM config "${expectedLLM}" in status. Got: ${JSON.stringify(actualLLMs)}`
                );
            }
        }

        // Check tags for model and agent information
        const modelTags = statusTags.filter((tag) => tag[0] === "model");
        const agentTags = statusTags.filter((tag) => tag[0] === "p"); // agent pubkeys are tagged as 'p'

        if (modelTags.length === 0) {
            console.log(
                "⚠️  Warning: No 'model' tags found in status event. Checking if LLM configs are included differently..."
            );
            // This might be expected if models are only in content, not tags
        }

        if (agentTags.length === 0) {
            throw new Error("No agent tags ('p' tags) found in status event");
        }

        console.log("✅ Status event validation passed:");
        console.log(`   - Status: ${statusContent.status}`);
        console.log(`   - Project: ${statusContent.project}`);
        console.log(`   - LLM Configs: ${JSON.stringify(statusContent.llmConfigs)}`);
        console.log(`   - Agent Tags: ${agentTags.length} agents found`);
        console.log(`   - Model Tags: ${modelTags.length} model tags found`);

        // 7. Verify the test passed
        console.log("\n✨ Comprehensive E2E Test Summary:");
        console.log("- ✅ Generated new Nostr identity");
        console.log("- ✅ Created project via cli-client");
        console.log("- ✅ Initialized project with tenex project init");
        console.log("- ✅ Added mock LLM configurations");
        console.log("- ✅ Set up Nostr event listener");
        console.log("- ✅ Started project with tenex project run");
        console.log("- ✅ Captured and validated status event");
        console.log("- ✅ Verified LLM configs in status content");
        console.log("- ✅ Verified agent information in tags");

        console.log("\n🎉 Comprehensive E2E test completed successfully!");
    } catch (error) {
        console.error("\n❌ E2E test failed:", error);

        // Print last few lines of tenex run output for debugging
        if (tenexRunProcess) {
            console.log("\nLast tenex run output:");
            console.log(tenexRunProcess.output.slice(-20).join("\n"));
        }

        throw error;
    } finally {
        // Clean up NDK connection
        if (subscription) {
            subscription.stop();
        }
        if (ndk) {
            ndk.pool?.disconnect();
        }

        await cleanup(tenexRunProcess);
    }
}

// Run the test
if (import.meta.main) {
    runE2ETest()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
