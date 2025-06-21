#!/usr/bin/env bun

import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { fileURLToPath } from "url";

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

class E2ETestRunner {
    private processes: ProcessInfo[] = [];
    private config: TestConfig;

    constructor() {
        const signer = NDKPrivateKeySigner.generate();
        const timestamp = Date.now();
        
        this.config = {
            nsec: signer.privateKey!,
            npub: signer.pubkey,
            projectName: `E2E Test Project ${timestamp}`,
            projectId: `e2e-test-${timestamp}`,
            workDir: path.join(__dirname, "test-workspace", `run-${timestamp}`),
            llmConfig: {
                provider: "openrouter",
                model: "deepseek/deepseek-chat-v3-0324",
                apiKey: "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",
                baseUrl: "https://openrouter.ai/api/v1"
            }
        };
    }

    private async setupWorkspace() {
        console.log("📁 Setting up test workspace...");
        await fs.mkdir(this.config.workDir, { recursive: true });
        
        // Create global .tenex directory for LLM config
        const globalTenexDir = path.join(this.config.workDir, ".tenex");
        await fs.mkdir(globalTenexDir, { recursive: true });
        
        // Create LLM config in the format expected by ConfigurationService
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
        console.log(`✅ LLM config created with model: ${this.config.llmConfig.model}`);
    }

    private startProcess(name: string, command: string, args: string[], options?: any): ProcessInfo {
        console.log(`\n🚀 Starting ${name}: ${command} ${args.join(" ")}`);
        
        const child = spawn(command, args, {
            stdio: ["pipe", "pipe", "pipe"],
            env: { 
                ...process.env, 
                FORCE_COLOR: "0",
                HOME: this.config.workDir  // Ensure all processes use our workspace as HOME
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
        inputs: Array<{ wait?: string; send: string; description?: string }>
    ) {
        for (const input of inputs) {
            if (input.description) {
                console.log(`\n💬 ${input.description}`);
            }

            if (input.wait) {
                await this.waitForCondition(
                    () => cliProcess.output.some(line => line.includes(input.wait)),
                    15000,
                    100,
                    `Waiting for "${input.wait}"`
                );
            }

            console.log(`📝 Sending: ${input.send}`);
            cliProcess.process.stdin?.write(input.send + "\n");
            await setTimeout(2000); // Give it time to process
        }
    }

    async run() {
        console.log("🎯 Starting Full User Flow E2E Test");
        console.log("=====================================");

        try {
            // Step 1: Setup workspace
            await this.setupWorkspace();
            
            // Step 2: Start daemon with environment pointing to our workspace
            console.log("\n📡 Starting TENEX daemon...");
            const daemon = this.startProcess(
                "daemon",
                "bun",
                [
                    TENEX_PATH,
                    "daemon",
                    "--whitelist", this.config.npub
                ],
                { 
                    cwd: this.config.workDir,
                    env: {
                        ...process.env,
                        HOME: this.config.workDir  // Set HOME to our workspace so it finds .tenex/llms.json
                    }
                }
            );

            await this.waitForCondition(
                () => daemon.output.some(line => 
                    line.includes("daemon is running") ||
                    line.includes("Event monitor started") ||
                    line.includes("Monitoring events")
                ),
                20000,
                500,
                "Daemon startup"
            );
            console.log("✅ Daemon started successfully");

            // Step 3: Create project
            console.log("\n📦 Creating project...");
            const createResult = await this.runCommand(
                "bun",
                [
                    CLI_CLIENT_PATH,
                    "project", "create",
                    "--name", this.config.projectName,
                    "--nsec", this.config.nsec
                ],
                { cwd: this.config.workDir }
            );

            // Extract project NADDR from output
            const naddrMatch = createResult.stdout.match(/naddr1[a-z0-9]+/);
            if (!naddrMatch) {
                throw new Error("Failed to extract project NADDR from creation output");
            }
            const projectNaddr = naddrMatch[0];
            console.log(`✅ Project created with NADDR: ${projectNaddr}`);

            // Step 4: Start project
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

            // Wait for project to be picked up by daemon
            await this.waitForCondition(
                () => daemon.output.some(line => 
                    line.includes("Started project process") ||
                    line.includes("Starting listener for project") ||
                    line.includes("Project Information")
                ),
                20000,
                500,
                "Project startup"
            );
            console.log("✅ Project process started by daemon");

            // Wait for project to come online
            await this.waitForCondition(
                () => daemon.output.some(line => 
                    line.includes("Ready to process events") ||
                    line.includes("Project listener active") ||
                    line.includes('"status":"online"')
                ),
                30000,
                500,
                "Project online status"
            );
            console.log("✅ Project is online and ready");

            // Step 5: Start chat session
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
                        NSEC: this.config.nsec  // Add NSEC to environment
                    }
                }
            );

            // Navigate through chat CLI
            await this.interactWithCLI(chatProcess, [
                {
                    wait: "What would you like to do?",
                    send: "", // Just press enter to select the default option (Connect to existing project)
                    description: "Selecting 'Connect to project'"
                },
                {
                    wait: "Enter project NADDR:",
                    send: projectNaddr,
                    description: "Entering project NADDR"
                }
            ]);

            // Wait for connection success and agent discovery
            await this.waitForCondition(
                () => chatProcess.output.some(line => 
                    line.includes("Connected to project:") ||
                    line.includes("Discovered") && line.includes("agents")
                ),
                10000,
                100,
                "Project connection"
            );
            console.log("✅ Connected to project via chat");

            // After connection, wait for the next menu
            await this.interactWithCLI(chatProcess, [
                {
                    wait: "What would you like to do?",
                    send: "", // Press enter to select "Start new thread"
                    description: "Selecting 'Start new thread'"
                },
                {
                    wait: "Thread title:",
                    send: "Hello World Test Thread",
                    description: "Setting thread title"
                },
                {
                    wait: "Thread content",
                    send: "@agent I need you to plan and implement a simple hello world test application. Create a JavaScript file that prints 'Hello from E2E test!' and uses console.assert to verify it works. Please create a plan first.",
                    description: "Sending request to agent"
                }
            ]);

            // Wait a bit for thread creation to complete
            await setTimeout(3000);
            
            console.log("✅ Message sent to agent");

            // Wait for agent response
            console.log("\n⏳ Waiting for agent to process and respond...");
            
            // Monitor for agent activity
            let agentActivity = false;
            const responseTimeout = 30000; // 30 seconds
            const startTime = Date.now();

            while (Date.now() - startTime < responseTimeout) {
                // Check for any agent activity
                if (daemon.output.some(line => 
                    line.includes("Agent") && line.includes("executing") ||
                    line.includes("LLM completion successful") ||
                    line.includes("Agent response generated") ||
                    line.includes("Published agent response") ||
                    line.includes("Conversation routed successfully")
                )) {
                    agentActivity = true;
                    console.log("✅ Agent processed the request");
                    break;
                }

                await setTimeout(1000);
            }

            if (!agentActivity) {
                console.log("⚠️  Agent response timeout - checking for partial success");
            }

            // Step 6: Verify results
            console.log("\n🔍 Verifying test results...");
            
            // Look for the project directory in daemon output
            const projectPathMatch = daemon.output.find(line => 
                line.includes("projectPath") || line.includes("Working directory")
            );

            let testFileFound = false;
            if (projectPathMatch) {
                const pathMatch = projectPathMatch.match(/['":]([^"',}]*projects[^"',}]*)/);
                if (pathMatch) {
                    const projectPath = pathMatch[1];
                    console.log(`📂 Checking project directory: ${projectPath}`);
                    
                    try {
                        // Look for any .js test files created
                        const files = await fs.readdir(projectPath);
                        const testFiles = files.filter(f => f.endsWith('.js') && f.includes('test'));
                        
                        if (testFiles.length > 0) {
                            testFileFound = true;
                            console.log(`✅ Found test file(s): ${testFiles.join(", ")}`);
                            
                            // Read and display the first test file
                            const testContent = await fs.readFile(
                                path.join(projectPath, testFiles[0]), 
                                "utf-8"
                            );
                            console.log("\n📄 Test file content:");
                            console.log("-------------------");
                            console.log(testContent);
                            console.log("-------------------");
                        }
                    } catch (err) {
                        console.log(`⚠️  Could not read project directory: ${err}`);
                    }
                }
            }

            // Summary
            console.log("\n✨ E2E Test Summary:");
            console.log("===================");
            console.log(`✅ Workspace created`);
            console.log(`✅ Daemon started with LLM config`);
            console.log(`✅ Project created: ${this.config.projectName}`);
            console.log(`✅ Project started and came online`);
            console.log(`✅ Connected to project via chat`);
            console.log(`✅ Thread created and message sent`);
            console.log(`${agentActivity ? "✅" : "❌"} Agent processed the request`);
            console.log(`${testFileFound ? "✅" : "❌"} Test file created`);

            const success = agentActivity || testFileFound;
            
            if (success) {
                console.log("\n🎉 E2E test completed successfully!");
            } else {
                console.log("\n⚠️  Test partially successful - some steps may have timed out");
            }

            return success;

        } finally {
            // Cleanup
            console.log("\n🧹 Cleaning up...");
            
            // Terminate all processes
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
            console.log(`✅ Cleanup complete`);
        }
    }
}

// Run the test
if (import.meta.main) {
    const runner = new E2ETestRunner();
    runner.run()
        .then((success) => process.exit(success ? 0 : 1))
        .catch((error) => {
            console.error("\n❌ Test failed with error:", error);
            process.exit(1);
        });
}