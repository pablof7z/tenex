#!/usr/bin/env bun

/**
 * Working E2E test that creates a project with a proper agent
 * to ensure Claude Code can be triggered through the complete flow
 */

import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { NDKPrivateKeySigner, NDKEvent } from "@nostr-dev-kit/ndk";
import { fileURLToPath } from "url";
import NDK from "@nostr-dev-kit/ndk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TENEX_PATH = path.join(__dirname, "..", "..", "tenex", "bin", "tenex.ts");
const CLI_CLIENT_PATH = path.join(__dirname, "..", "..", "cli-client", "src", "index.ts");

interface ProcessInfo {
    process: ChildProcess;
    output: string[];
    errors: string[];
    name: string;
}

interface TestConfig {
    nsec: string;
    npub: string;
    agentNsec: string;
    agentNpub: string;
    projectName: string;
    projectId: string;
    workDir: string;
    llmConfig: {
        provider: string;
        model: string;
        apiKey: string;
        baseUrl: string;
    };
}

class WorkingClaudeTest {
    private processes: ProcessInfo[] = [];
    private config: TestConfig;
    private ndk: NDK;

    constructor() {
        const signer = NDKPrivateKeySigner.generate();
        const agentSigner = NDKPrivateKeySigner.generate();
        const timestamp = Date.now();
        
        this.config = {
            nsec: signer.privateKey!,
            npub: signer.pubkey,
            agentNsec: agentSigner.privateKey!,
            agentNpub: agentSigner.pubkey,
            projectName: `Working Claude Test ${timestamp}`,
            projectId: `working-claude-${timestamp}`,
            workDir: path.join(__dirname, "test-workspace", `working-${timestamp}`),
            llmConfig: {
                provider: "openrouter",
                model: "deepseek/deepseek-chat-v3-0324",
                apiKey: "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",
                baseUrl: "https://openrouter.ai/api/v1"
            }
        };

        // Initialize NDK for creating agent event
        this.ndk = new NDK({
            explicitRelayUrls: [
                "wss://relay.damus.io",
                "wss://relay.nostr.band",
                "wss://nos.lol",
                "wss://relay.primal.net"
            ]
        });
    }

    private async setupWorkspace() {
        console.log("📁 Setting up test workspace...");
        await fs.mkdir(this.config.workDir, { recursive: true });
        
        // Create global .tenex directory for LLM config
        const globalTenexDir = path.join(this.config.workDir, ".tenex");
        await fs.mkdir(globalTenexDir, { recursive: true });
        
        // Create LLM config
        const llmConfig = {
            configurations: {
                default: {
                    provider: this.config.llmConfig.provider,
                    model: this.config.llmConfig.model
                }
            },
            defaults: {
                default: "default",
                routing: "default",
                agent: "default"
            },
            credentials: {
                [this.config.llmConfig.provider]: {
                    apiKey: this.config.llmConfig.apiKey,
                    baseUrl: this.config.llmConfig.baseUrl
                }
            }
        };
        
        await fs.writeFile(
            path.join(globalTenexDir, "llms.json"),
            JSON.stringify(llmConfig, null, 2)
        );
        
        console.log(`✅ Workspace created at: ${this.config.workDir}`);
    }

    private async createAgentEvent(): Promise<string> {
        console.log("\n🤖 Creating agent event...");
        
        await this.ndk.connect();
        
        const agentSigner = new NDKPrivateKeySigner(this.config.agentNsec);
        
        // Create agent definition event
        const agentEvent = new NDKEvent(this.ndk, {
            kind: 31007, // Agent definition kind
            pubkey: agentSigner.pubkey,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ["d", `test-agent-${Date.now()}`],
                ["title", "Test Developer Agent"],
                ["role", "developer"],
                ["description", "An agent specialized in development tasks"],
                ["version", "1.0.0"]
            ],
            content: JSON.stringify({
                instructions: "You are a helpful developer agent that implements plans and creates code.",
                expertise: ["development", "coding", "implementation", "planning", "architecture"],
                capabilities: ["claude-code", "implementation", "planning"]
            })
        });

        await agentEvent.sign(agentSigner);
        await agentEvent.publish();
        
        console.log(`✅ Agent event created: ${agentEvent.id}`);
        
        return agentEvent.id;
    }

    private startProcess(name: string, command: string, args: string[], options?: any): ProcessInfo {
        console.log(`\n🚀 Starting ${name}: ${command} ${args.join(" ")}`);
        
        const child = spawn(command, args, {
            stdio: ["pipe", "pipe", "pipe"],
            env: { 
                ...process.env, 
                FORCE_COLOR: "0",
                HOME: this.config.workDir
            },
            ...options
        });

        const info: ProcessInfo = {
            process: child,
            output: [],
            errors: [],
            name
        };

        child.stdout?.on("data", (data) => {
            const text = data.toString();
            const lines = text.split("\n").filter(Boolean);
            info.output.push(...lines);
            console.log(`[${name}] ${text.trim()}`);
        });

        child.stderr?.on("data", (data) => {
            const text = data.toString();
            const lines = text.split("\n").filter(Boolean);
            info.errors.push(...lines);
            console.error(`[${name} ERROR] ${text.trim()}`);
        });

        child.on("error", (error) => {
            console.error(`[${name} PROCESS ERROR] ${error.message}`);
        });

        child.on("exit", (code, signal) => {
            console.log(`[${name}] Process exited with code ${code}, signal ${signal}`);
        });

        this.processes.push(info);
        return info;
    }

    private async waitForCondition(
        check: () => boolean | Promise<boolean>,
        timeout = 30000,
        interval = 500,
        description?: string
    ): Promise<void> {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            if (await check()) {
                return;
            }
            await setTimeout(interval);
        }
        throw new Error(`Timeout waiting for condition${description ? `: ${description}` : ""}`);
    }

    private async runCommand(
        command: string,
        args: string[],
        options?: any
    ): Promise<{ stdout: string; stderr: string }> {
        return new Promise((resolve, reject) => {
            console.log(`\n📟 Running command: ${command} ${args.join(" ")}`);
            
            const child = spawn(command, args, {
                ...options,
                env: { 
                    ...process.env, 
                    FORCE_COLOR: "0",
                    HOME: this.config.workDir
                }
            });
            
            let stdout = "";
            let stderr = "";

            child.stdout?.on("data", (data) => {
                const text = data.toString();
                stdout += text;
                console.log(`[COMMAND OUTPUT] ${text.trim()}`);
            });

            child.stderr?.on("data", (data) => {
                const text = data.toString();
                stderr += text;
                console.error(`[COMMAND ERROR] ${text.trim()}`);
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

    private async interactWithCLI(
        cliProcess: ProcessInfo,
        inputs: Array<{ wait?: string | RegExp; send: string; description?: string; delay?: number }>
    ) {
        for (const input of inputs) {
            if (input.description) {
                console.log(`\n💬 ${input.description}`);
            }

            if (input.wait) {
                await this.waitForCondition(
                    () => {
                        if (typeof input.wait === 'string') {
                            return cliProcess.output.some(line => line.includes(input.wait));
                        } else {
                            return cliProcess.output.some(line => input.wait!.test(line));
                        }
                    },
                    15000,
                    100,
                    `Waiting for "${input.wait}"`
                );
            }

            console.log(`📝 Sending: ${input.send}`);
            cliProcess.process.stdin?.write(input.send + "\n");
            await setTimeout(input.delay || 2000);
        }
    }

    async run() {
        console.log("🎯 Starting Working Claude Code E2E Test");
        console.log("========================================");

        try {
            // Step 1: Setup workspace
            await this.setupWorkspace();
            
            // Step 2: Create agent event
            const agentEventId = await this.createAgentEvent();
            
            // Step 3: Start daemon
            console.log("\n📡 Starting TENEX daemon...");
            const daemon = this.startProcess(
                "daemon",
                "bun",
                [
                    TENEX_PATH,
                    "daemon",
                    "--whitelist", this.config.npub,
                    "--whitelist", this.config.agentNpub // Also whitelist our agent
                ],
                { cwd: this.config.workDir }
            );

            await this.waitForCondition(
                () => daemon.output.some(line => 
                    line.includes("daemon is running") ||
                    line.includes("Event monitor started")
                ),
                20000,
                500,
                "Daemon startup"
            );
            console.log("✅ Daemon started successfully");

            // Step 4: Create project with the agent
            console.log("\n📦 Creating project with agent...");
            const createResult = await this.runCommand(
                "bun",
                [
                    CLI_CLIENT_PATH,
                    "project", "create",
                    "--name", this.config.projectName,
                    "--nsec", this.config.nsec,
                    "--agent", agentEventId // Include our agent in the project
                ],
                { cwd: this.config.workDir }
            );

            // Extract project NADDR
            const naddrMatch = createResult.stdout.match(/naddr1[a-z0-9]+/);
            if (!naddrMatch) {
                throw new Error("Failed to extract project NADDR");
            }
            const projectNaddr = naddrMatch[0];
            console.log(`✅ Project created with NADDR: ${projectNaddr}`);

            // Step 5: Start project
            console.log("\n🚀 Starting project...");
            await this.runCommand(
                "bun",
                [
                    CLI_CLIENT_PATH,
                    "project", "start",
                    "--project", projectNaddr,
                    "--nsec", this.config.nsec
                ],
                { cwd: this.config.workDir }
            );

            // Wait for project to come online
            await this.waitForCondition(
                () => daemon.output.some(line => 
                    line.includes("Started project process") ||
                    line.includes("Ready to process events")
                ),
                30000,
                500,
                "Project startup"
            );
            console.log("✅ Project is online and ready");

            // Wait for agent to be loaded
            await this.waitForCondition(
                () => daemon.output.some(line => 
                    line.includes("Saved agent definition") ||
                    line.includes("Agent will be created")
                ),
                10000,
                500,
                "Agent loading"
            );
            console.log("✅ Agent loaded in project");

            // Step 6: Start chat session
            console.log("\n💬 Starting chat session...");
            const chatProcess = this.startProcess(
                "chat",
                "bun",
                [CLI_CLIENT_PATH, "chat"],
                { 
                    cwd: this.config.workDir,
                    env: {
                        ...process.env,
                        FORCE_COLOR: "0",
                        HOME: this.config.workDir,
                        NSEC: this.config.nsec
                    }
                }
            );

            // Navigate through chat CLI
            await this.interactWithCLI(chatProcess, [
                {
                    wait: "What would you like to do?",
                    send: "", // Press enter to select "Connect to existing project"
                    description: "Selecting 'Connect to project'"
                },
                {
                    wait: "Enter project NADDR:",
                    send: projectNaddr,
                    description: "Entering project NADDR"
                }
            ]);

            // Wait for connection and agent discovery
            await this.waitForCondition(
                () => chatProcess.output.some(line => 
                    line.includes("Connected to project:") ||
                    (line.includes("Discovered") && line.includes("agents"))
                ),
                10000,
                100,
                "Project connection"
            );
            console.log("✅ Connected to project via chat");

            // Step 7: Create conversation - Request a plan
            await this.interactWithCLI(chatProcess, [
                {
                    wait: "What would you like to do?",
                    send: "", // Press enter to select "Start new thread"
                    description: "Selecting 'Start new thread'"
                },
                {
                    wait: "Thread title:",
                    send: "Hello World Implementation",
                    description: "Setting thread title"
                },
                {
                    wait: "Thread content",
                    send: "@agent Create a plan for a simple hello world app that prints 'Hello from Claude Code!' with a test.",
                    description: "Requesting plan creation",
                    delay: 5000
                }
            ]);

            // Monitor for plan phase and Claude Code
            console.log("\n⏳ Monitoring for Claude Code execution...");
            
            const monitoringTimeout = 120000; // 2 minutes
            const startTime = Date.now();
            let planPhaseTriggered = false;
            let claudeCodeStarted = false;
            let executePhaseTriggered = false;

            while (Date.now() - startTime < monitoringTimeout) {
                // Check for plan phase
                if (!planPhaseTriggered && daemon.output.some(line => 
                    line.includes("phase:\"plan\"") ||
                    line.includes("plan phase") ||
                    line.includes("Plan phase initialized")
                )) {
                    planPhaseTriggered = true;
                    console.log("✅ Plan phase triggered");
                    
                    // Wait a bit then send approval
                    await setTimeout(5000);
                    console.log("\n📝 Sending plan approval...");
                    chatProcess.process.stdin?.write("Great plan! Please implement it now.\n");
                }

                // Check for execute phase
                if (!executePhaseTriggered && daemon.output.some(line => 
                    line.includes("phase:\"execute\"") ||
                    line.includes("execute phase") ||
                    line.includes("Execute phase initialized")
                )) {
                    executePhaseTriggered = true;
                    console.log("✅ Execute phase triggered");
                }

                // Check for Claude Code
                if (!claudeCodeStarted && daemon.output.some(line => 
                    line.includes("Claude Code") ||
                    line.includes("ClaudeCodeExecutor") ||
                    line.includes("claude code")
                )) {
                    claudeCodeStarted = true;
                    console.log("✅ Claude Code started!");
                    break; // Success!
                }

                await setTimeout(1000);
            }

            // Verify results
            console.log("\n🔍 Verifying results...");
            
            // Find project directory
            const projectPathMatch = daemon.output.find(line => 
                line.includes("projectPath")
            )?.match(/projectPath['":s]+([^"',}]+)/);
            
            let filesCreated = false;
            if (projectPathMatch) {
                const projectPath = projectPathMatch[1];
                console.log(`📂 Checking project directory: ${projectPath}`);
                
                try {
                    const files = await fs.readdir(projectPath);
                    const jsFiles = files.filter(f => f.endsWith('.js'));
                    filesCreated = jsFiles.length > 0;
                    
                    if (filesCreated) {
                        console.log(`✅ Found JavaScript files: ${jsFiles.join(", ")}`);
                    }
                } catch (err) {
                    console.log(`⚠️  Could not check files: ${err}`);
                }
            }

            // Summary
            console.log("\n✨ Test Summary:");
            console.log("================");
            console.log(`✅ Workspace created`);
            console.log(`✅ Agent event created`);
            console.log(`✅ Daemon started`);
            console.log(`✅ Project created with agent`);
            console.log(`✅ Project started`);
            console.log(`✅ Chat connected`);
            console.log(`${planPhaseTriggered ? "✅" : "❌"} Plan phase triggered`);
            console.log(`${executePhaseTriggered ? "✅" : "❌"} Execute phase triggered`);
            console.log(`${claudeCodeStarted ? "✅" : "❌"} Claude Code executed`);
            console.log(`${filesCreated ? "✅" : "❌"} Files created`);

            const success = claudeCodeStarted;
            
            if (success) {
                console.log("\n🎉 SUCCESS! Claude Code was triggered!");
            } else {
                console.log("\n⚠️  Test completed but Claude Code was not triggered");
            }

            return success;

        } finally {
            // Cleanup
            console.log("\n🧹 Cleaning up...");
            
            for (const proc of this.processes) {
                if (proc.process && !proc.process.killed) {
                    console.log(`Terminating ${proc.name}...`);
                    proc.process.kill("SIGTERM");
                    await setTimeout(1000);
                    if (!proc.process.killed) {
                        proc.process.kill("SIGKILL");
                    }
                }
            }

            // Disconnect NDK
            if (this.ndk) {
                this.ndk.pool?.closeAllRelays();
            }

            // Save logs
            const logsDir = path.join(this.config.workDir, "logs");
            await fs.mkdir(logsDir, { recursive: true });
            
            for (const proc of this.processes) {
                if (proc.output.length > 0 || proc.errors.length > 0) {
                    await fs.writeFile(
                        path.join(logsDir, `${proc.name}-output.log`),
                        proc.output.join("\n")
                    );
                    
                    if (proc.errors.length > 0) {
                        await fs.writeFile(
                            path.join(logsDir, `${proc.name}-errors.log`),
                            proc.errors.join("\n")
                        );
                    }
                }
            }
            
            console.log(`✅ Logs saved to: ${logsDir}`);
        }
    }
}

// Run the test
if (import.meta.main) {
    const test = new WorkingClaudeTest();
    test.run()
        .then((success) => process.exit(success ? 0 : 1))
        .catch((error) => {
            console.error("\n❌ Test failed with error:", error);
            process.exit(1);
        });
}