#!/usr/bin/env bun

import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { NDKEvent, NDKKind, NDKPrivateKeySigner, NDKProject } from "@nostr-dev-kit/ndk";
import { NDKAgent } from "../cli-client/src/events/agent.js";
import { getNDK } from "../cli-client/src/ndk-setup.js";

const TENEX_PATH = path.join(__dirname, "..", "tenex", "bin", "tenex.ts");
const CLI_CLIENT_PATH = path.join(__dirname, "..", "cli-client", "dist", "index.js");
const _TEST_TIMEOUT = 60000; // 60 seconds

interface ProcessInfo {
    process: ChildProcess;
    output: string[];
    errors: string[];
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

async function cleanup(daemon?: ProcessInfo) {
    console.log("\n🧹 Cleaning up...");

    // Kill daemon process
    if (daemon?.process) {
        daemon.process.kill("SIGTERM");
        await setTimeout(1000);
        if (!daemon.process.killed) {
            daemon.process.kill("SIGKILL");
        }
    }
}

async function buildCliClient() {
    console.log("🔨 Building cli-client...");
    const _buildResult = await runCommand("bun", ["run", "build"], {
        cwd: path.join(__dirname, "..", "cli-client"),
    });
    console.log("✅ CLI client built successfully");
}

async function runE2ETest() {
    console.log("🚀 Starting E2E test for project creation with agents");

    let daemon: ProcessInfo | undefined;

    try {
        // Build cli-client first
        await buildCliClient();

        // 1. Generate new Nostr key
        const signer = NDKPrivateKeySigner.generate();
        const pubkey = signer.pubkey;
        const nsec = signer.privateKey!;

        console.log(`\n📝 Generated new user with pubkey: ${pubkey}`);

        // 2. Fetch agents from Nostr
        console.log("\n🤖 Fetching agents from Nostr...");
        const ndk = await getNDK({ nsec });

        const agentEvents = await ndk.fetchEvents([{ kinds: [NDKAgent.kind], limit: 10 }]);
        const agents = Array.from(agentEvents).map((event) => NDKAgent.from(event));

        if (agents.length < 3) {
            throw new Error(`Not enough agents found. Found ${agents.length}, need at least 3`);
        }

        // Select 3 random agents
        const selectedAgents = agents.sort(() => Math.random() - 0.5).slice(0, 3);
        const agentIds = selectedAgents.map((agent) => agent.id);
        const agentNames = selectedAgents.map(
            (agent) => agent.name || agent.title || "Unnamed Agent"
        );

        console.log("✅ Selected 3 agents:");
        selectedAgents.forEach((_agent, i) => {
            console.log(`   ${i + 1}. ${agentNames[i]} (${agentIds[i].substring(0, 12)}...)`);
        });

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
                        line.includes("Monitoring events") ||
                        line.includes("Listening for events")
                ),
            15000
        );
        console.log("✅ Daemon started successfully");

        // 4. Create project with agents via NDK directly
        const randomNum = Math.floor(Math.random() * 900) + 100; // 3-digit random number
        const projectName = "Test With Agents";
        const projectId = `test-agents-${randomNum}`;

        console.log(`\n📦 Creating project with agents: ${projectName} (${projectId})`);

        const project = new NDKProject(ndk);

        // Set basic properties
        project.title = projectName;
        project.content = "E2E test project with agents";
        project.tags.push(["d", projectId]);
        project.hashtags = ["test", "e2e", "agents"];

        // Add agent references
        for (const agentId of agentIds) {
            project.tags.push(["agent", agentId]);
        }

        // Publish the project
        await project.publish();

        const projectNaddr = project.encode();
        console.log(`✅ Project created with NADDR: ${projectNaddr}`);
        console.log(
            `   Agent IDs: ${agentIds.map((id) => `${id.substring(0, 12)}...`).join(", ")}`
        );

        // 5. Send project start event
        console.log("\n📡 Sending project start event...");

        await runCommand("bun", [
            CLI_CLIENT_PATH,
            "project",
            "start",
            "--nsec",
            nsec, // privateKey is already in hex format
            "--project",
            projectNaddr,
        ]);

        console.log("✅ Project start event sent");

        // 5. Wait for daemon to detect the project and start tenex run
        console.log("\n⏳ Waiting for daemon to start project process...");
        await waitForCondition(
            () =>
                daemon!.output.some(
                    (line) =>
                        line.includes("Starting tenex run") ||
                        line.includes("tenex project run") ||
                        line.includes("spawning") ||
                        line.includes("Starting project") ||
                        line.includes("project process")
                ),
            20000
        );
        console.log("✅ Daemon detected project and started process");

        // 6. Wait for project to come online
        console.log("\n🔍 Waiting for project to come online...");
        await waitForCondition(
            () =>
                daemon!.output.some(
                    (line) =>
                        line.includes("Ready to process events") || // Project is ready
                        line.includes("Project listener active") ||
                        line.includes('"status":"online"') || // Status event content
                        line.includes("Publishing status")
                ),
            30000
        );
        console.log("✅ Project is online!");

        // 7. Wait a bit more for agent initialization and validate agent pubkeys
        console.log("\n🔍 Validating agent setup...");
        await setTimeout(5000); // Give agents time to initialize and publish profiles

        // Check for agent names in the daemon output (more reliable than pubkeys)
        let foundAgentNames = 0;

        for (const agentName of agentNames) {
            const found = daemon!.output.some((line) => line.includes(agentName));
            if (found) {
                foundAgentNames++;
                console.log(`   ✅ Found agent in output: ${agentName}`);
            } else {
                console.log(`   ⚠️  Agent name not found in output: ${agentName}`);
            }
        }

        // Check if the system created kind:0 metadata events for the agents
        console.log("\n🔍 Checking for agent metadata events...");
        let foundMetadataEvents = 0;

        // Look for agent pubkeys from the project
        const projectPath = daemon!.output
            .find((line) => line.includes("projectPath"))
            ?.match(/projectPath['\":\s]+([^\"',}]+)/)?.[1];

        if (projectPath) {
            try {
                const agentsJsonPath = path.join(projectPath, ".tenex", "agents.json");
                const agentsJson = JSON.parse(await fs.readFile(agentsJsonPath, "utf-8"));

                // Get the agent pubkeys from agents.json
                const agentPubkeys: string[] = [];
                for (const [_role, agentInfo] of Object.entries(agentsJson)) {
                    if (
                        typeof agentInfo === "object" &&
                        agentInfo !== null &&
                        "nsec" in agentInfo
                    ) {
                        // Convert nsec to pubkey
                        const signer = new NDKPrivateKeySigner(agentInfo.nsec as string);
                        agentPubkeys.push(signer.pubkey);
                    }
                }

                // Check if we can find metadata events for these agents
                console.log(`   Checking metadata for ${agentPubkeys.length} agent pubkeys...`);

                // Fetch metadata events from Nostr
                const metadataEvents = await ndk.fetchEvents({
                    kinds: [NDKKind.Metadata],
                    authors: agentPubkeys,
                });

                for (const event of metadataEvents) {
                    try {
                        const metadata = JSON.parse(event.content);
                        if (metadata.name?.includes(projectId)) {
                            foundMetadataEvents++;
                            console.log(`   ✅ Found metadata for agent: ${metadata.name}`);
                        }
                    } catch (_e) {
                        // Ignore parsing errors
                    }
                }

                console.log(
                    `   Found ${foundMetadataEvents}/${agentPubkeys.length} metadata events`
                );
            } catch (error) {
                console.log(`   ❌ Failed to check metadata: ${error}`);
            }
        }

        // Check if agents.json was created with proper references
        if (projectPath) {
            try {
                const agentsJsonPath = path.join(projectPath, ".tenex", "agents.json");
                const agentsJson = JSON.parse(await fs.readFile(agentsJsonPath, "utf-8"));
                const agentCount = Object.keys(agentsJson).length;
                console.log(`   ✅ agents.json created with ${agentCount} agents`);

                // Check if agent files were created
                const agentsDir = path.join(projectPath, ".tenex", "agents");
                const agentFiles = await fs.readdir(agentsDir);
                const jsonFiles = agentFiles.filter((f) => f.endsWith(".json"));
                console.log(`   ✅ ${jsonFiles.length} agent definition files created`);

                if (jsonFiles.length === 3) {
                    console.log("   ✅ All 3 agents properly initialized");
                } else {
                    console.log(`   ⚠️  Expected 3 agent files, found ${jsonFiles.length}`);
                }
            } catch (error) {
                console.log(`   ❌ Failed to validate agent files: ${error}`);
            }
        }

        // 8. Verify the test passed
        console.log("\n✨ E2E Test Summary:");
        console.log("- ✅ Generated new Nostr identity");
        console.log("- ✅ Fetched 3 agents from Nostr");
        console.log("- ✅ Started daemon with whitelist");
        console.log("- ✅ Created project with agents");
        console.log("- ✅ Sent project start event");
        console.log("- ✅ Daemon detected and started project");
        console.log("- ✅ Project came online");
        console.log(
            `- ${foundAgentNames === 3 ? "✅" : "⚠️ "} Agent validation (${foundAgentNames}/3 agents found in output)`
        );
        console.log(
            `- ${foundMetadataEvents === 3 ? "✅" : "⚠️ "} Agent metadata (${foundMetadataEvents}/3 kind:0 events with proper names)`
        );

        if (foundAgentNames < 3) {
            console.log("\n⚠️  Not all agent names were found in daemon output");
        }

        if (foundMetadataEvents < 3) {
            console.log("\n⚠️  Not all agents published kind:0 metadata events");
        }

        console.log("\n🎉 E2E test with agents completed!");
    } catch (error) {
        console.error("\n❌ E2E test failed:", error);

        // Print last few lines of daemon output for debugging
        if (daemon) {
            console.log("\nLast daemon output:");
            console.log(daemon.output.slice(-20).join("\n"));
        }

        throw error;
    } finally {
        await cleanup(daemon);
    }
}

// Run the test
if (import.meta.main) {
    runE2ETest()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
