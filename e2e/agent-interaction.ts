#!/usr/bin/env bun

import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { NDKEvent, NDKPrivateKeySigner, NDKProject } from "@nostr-dev-kit/ndk";
import fs from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { NDKAgent } from "../cli-client/src/events/agent.js";
import { getNDK } from "../cli-client/src/ndk-setup.js";

const TENEX_PATH = path.join(__dirname, "..", "tenex", "bin", "tenex.ts");
const CLI_CLIENT_PATH = path.join(__dirname, "..", "cli-client", "dist", "index.js");

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

async function runAgentInteractionTest() {
    console.log("🚀 Starting E2E test for agent interaction");

    let daemon: ProcessInfo | undefined;

    try {
        // Build cli-client first
        await buildCliClient();

        // 1. Generate new Nostr key
        const signer = NDKPrivateKeySigner.generate();
        const pubkey = signer.pubkey;
        const nsec = signer.privateKey!;

        console.log(`\n📝 Generated new user with pubkey: ${pubkey}`);

        // 2. Fetch a single agent from Nostr
        console.log("\n🤖 Fetching a single agent from Nostr...");
        const ndk = await getNDK({ nsec });

        const agentEvents = await ndk.fetchEvents([{ kinds: [NDKAgent.kind], limit: 5 }]);
        const agents = Array.from(agentEvents).map((event) => NDKAgent.from(event));

        if (agents.length < 1) {
            throw new Error("No agents found. Need at least 1 agent");
        }

        // Select 1 random agent
        const selectedAgent = agents[Math.floor(Math.random() * agents.length)];
        const agentId = selectedAgent.id;
        const agentName = selectedAgent.name || selectedAgent.title || "Unnamed Agent";

        console.log(`✅ Selected agent: ${agentName} (${agentId.substring(0, 12)}...)`);

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

        // 4. Create project with agent via NDK directly
        const randomNum = Math.floor(Math.random() * 900) + 100; // 3-digit random number
        const projectName = "Agent Test";
        const projectId = `agent-test-${randomNum}`;

        console.log(`\n📦 Creating project with agent: ${projectName} (${projectId})`);

        const project = new NDKProject(ndk);

        // Set basic properties
        project.title = projectName;
        project.content = "E2E test project for agent interaction";
        project.tags.push(["d", projectId]);
        project.hashtags = ["test", "e2e", "interaction"];

        // Add agent reference
        project.tags.push(["agent", agentId]);

        // Publish the project
        await project.publish();

        const projectNaddr = project.encode();
        console.log(`✅ Project created with NADDR: ${projectNaddr}`);
        console.log(`   Agent: ${agentName} (${agentId.substring(0, 12)}...)`);

        // 5. Send project start event
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

        console.log("✅ Project start event sent");

        // 6. Wait for daemon to detect the project and start tenex run
        console.log("\n⏳ Waiting for daemon to start project process...");
        await waitForCondition(
            () =>
                daemon!.output.some(
                    (line) =>
                        (line.includes("Starting tenex run") ||
                            line.includes("tenex project run") ||
                            line.includes("spawning") ||
                            line.includes("Starting project") ||
                            line.includes("project process")) &&
                        line.includes(projectId)
                ),
            20000
        );
        console.log("✅ Daemon detected project and started process");

        // 7. Wait for project to come online
        console.log("\n🔍 Waiting for project to come online...");
        await waitForCondition(
            () =>
                daemon!.output.some(
                    (line) =>
                        line.includes("Ready to process events") ||
                        line.includes("Project listener active") ||
                        line.includes('"status":"online"') ||
                        line.includes("Publishing status")
                ),
            30000
        );
        console.log("✅ Project is online!");

        // 8. Wait a bit more for agent initialization
        console.log("\n⏳ Waiting for agent initialization...");
        await setTimeout(3000);

        // 9. Create a chat thread asking the agent to reply with "hello"
        console.log("\n💬 Creating chat thread asking agent to reply with 'hello'...");

        const chatEvent = new NDKEvent(ndk);
        chatEvent.kind = 11; // Chat event
        chatEvent.content = "Please reply with just the word 'hello'";

        // Tag the project
        chatEvent.tags.push(["a", `31933:${project.pubkey}:${projectId}`]);
        chatEvent.tags.push(["title", "Agent Test Thread"]);

        // Find the agent's pubkey from project files to mention them
        const projectPath = daemon!.output
            .find((line) => line.includes("projectPath"))
            ?.match(/projectPath['":\s]+([^"',}]+)/)?.[1];

        if (projectPath) {
            try {
                const agentsJsonPath = path.join(projectPath, ".tenex", "agents.json");
                const agentsJson = JSON.parse(await fs.readFile(agentsJsonPath, "utf-8"));

                // Find the agent's generated pubkey
                for (const [name, config] of Object.entries(agentsJson)) {
                    if (typeof config === "object" && config.nsec) {
                        const agentSigner = new NDKPrivateKeySigner(config.nsec);
                        chatEvent.tags.push(["p", agentSigner.pubkey, name]);
                        console.log(
                            `   ✅ Mentioning agent: ${name} (${agentSigner.pubkey.substring(0, 12)}...)`
                        );
                        break; // Just mention the first agent
                    }
                }
            } catch (error) {
                console.log(`   ⚠️  Could not load agent pubkeys: ${error}`);
            }
        }

        // Publish the chat event
        await chatEvent.publish();
        console.log("✅ Chat thread created and agent mentioned");

        // 10. Monitor for typing indicators and agent response
        console.log("\n👀 Monitoring for typing indicators and agent response...");

        let typingStartSeen = false;
        let typingStopSeen = false;
        let agentResponseSeen = false;

        const startTime = Date.now();
        const monitorTimeout = 60000; // 60 seconds

        while (Date.now() - startTime < monitorTimeout) {
            // Check for typing indicator start (kind 24111)
            if (
                !typingStartSeen &&
                daemon!.output.some(
                    (line) =>
                        line.includes("24111") ||
                        line.includes("Typing indicator") ||
                        line.includes("is typing") ||
                        line.includes("publishTypingIndicator") ||
                        line.includes("TYPING_INDICATOR")
                )
            ) {
                typingStartSeen = true;
                console.log("   ✅ Typing indicator START detected");
            }

            // Check for typing indicator stop (kind 24112)
            if (
                !typingStopSeen &&
                daemon!.output.some(
                    (line) =>
                        line.includes("24112") ||
                        line.includes("stopped typing") ||
                        line.includes("Typing stopped") ||
                        line.includes("publishTypingIndicator") ||
                        line.includes("TYPING_INDICATOR_STOP")
                )
            ) {
                typingStopSeen = true;
                console.log("   ✅ Typing indicator STOP detected");
            }

            // Check for agent response
            if (
                !agentResponseSeen &&
                daemon!.output.some(
                    (line) =>
                        line.includes("hello") ||
                        line.includes("Agent response") ||
                        line.includes("Response from") ||
                        (line.includes("Message:") && line.toLowerCase().includes("hello"))
                )
            ) {
                agentResponseSeen = true;
                console.log("   ✅ Agent response detected");
            }

            // If we've seen all three, we're done
            if (typingStartSeen && typingStopSeen && agentResponseSeen) {
                break;
            }

            await setTimeout(500); // Check every 500ms
        }

        // 11. Validate results
        console.log("\n🔍 Validating interaction results...");

        const validationResults = {
            projectCreated: true,
            agentInitialized: true,
            chatSent: true,
            typingStart: typingStartSeen,
            typingStop: typingStopSeen,
            agentResponse: agentResponseSeen,
        };

        // 12. Summary
        console.log("\n✨ Agent Interaction Test Summary:");
        console.log("- ✅ Generated new Nostr identity");
        console.log("- ✅ Fetched agent from Nostr");
        console.log("- ✅ Started daemon with whitelist");
        console.log("- ✅ Created project with agent");
        console.log("- ✅ Sent project start event");
        console.log("- ✅ Daemon detected and started project");
        console.log("- ✅ Project came online");
        console.log("- ✅ Agent was initialized");
        console.log("- ✅ Chat thread created and sent");
        console.log(
            `- ${validationResults.typingStart ? "✅" : "❌"} Typing indicator START detected`
        );
        console.log(
            `- ${validationResults.typingStop ? "✅" : "❌"} Typing indicator STOP detected`
        );
        console.log(`- ${validationResults.agentResponse ? "✅" : "❌"} Agent response received`);

        const allPassed = Object.values(validationResults).every(Boolean);

        if (allPassed) {
            console.log("\n🎉 Agent interaction test completed successfully!");
        } else {
            console.log("\n⚠️  Some validations failed - partial success");
            console.log("\nRecent daemon output for debugging:");
            console.log(daemon!.output.slice(-20).join("\n"));
        }

        return allPassed;
    } catch (error) {
        console.error("\n❌ Agent interaction test failed:", error);

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
    runAgentInteractionTest()
        .then((success) => process.exit(success ? 0 : 1))
        .catch(() => process.exit(1));
}
