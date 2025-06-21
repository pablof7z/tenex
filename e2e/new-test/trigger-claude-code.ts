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

/**
 * E2E Test specifically designed to trigger Claude Code execution
 * by properly transitioning through all phases: chat → plan → execute
 */
class TriggerClaudeCodeTest {
    private processes: ProcessInfo[] = [];
    private config: TestConfig;

    constructor() {
        const signer = NDKPrivateKeySigner.generate();
        const timestamp = Date.now();
        
        this.config = {
            nsec: signer.privateKey!,
            npub: signer.pubkey,
            projectName: `Claude Code Trigger Test ${timestamp}`,
            projectId: `claude-trigger-${timestamp}`,
            workDir: path.join(__dirname, "test-workspace", `trigger-${timestamp}`),
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
        inputs: Array<{ wait?: string; send: string; description?: string; delay?: number }>
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
            await setTimeout(input.delay || 2000); // Give it time to process
        }
    }

    async run() {
        console.log("🎯 Starting Claude Code Trigger E2E Test");
        console.log("=========================================");

        try {
            // Step 1: Setup workspace
            await this.setupWorkspace();
            
            // Step 2: Start daemon
            console.log("\n📡 Starting TENEX daemon...");
            const daemon = this.startProcess(
                "daemon",
                "bun",
                [
                    TENEX_PATH,
                    "daemon",
                    "--whitelist", this.config.npub
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

            // Extract project NADDR
            const naddrMatch = createResult.stdout.match(/naddr1[a-z0-9]+/);
            if (!naddrMatch) {
                throw new Error("Failed to extract project NADDR");
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
                        NSEC: this.config.nsec
                    }
                }
            );

            // Navigate through chat CLI to connect to project
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

            // Wait for connection success
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

            // Step 6: Start conversation - First ask for a plan
            await this.interactWithCLI(chatProcess, [
                {
                    wait: "What would you like to do?",
                    send: "", // Press enter to select "Start new thread"
                    description: "Selecting 'Start new thread'"
                },
                {
                    wait: "Thread title:",
                    send: "Hello World Test Implementation",
                    description: "Setting thread title"
                },
                {
                    wait: "Thread content",
                    send: "@agent I need you to create a plan for a simple hello world JavaScript application. The app should print 'Hello from Claude Code E2E test!' and include a test that verifies the output using console.assert. Please create a detailed plan.",
                    description: "Requesting a plan from the agent",
                    delay: 5000 // Give more time for plan creation
                }
            ]);

            // Wait for plan phase to be triggered
            console.log("\n⏳ Waiting for plan phase to be triggered...");
            await this.waitForCondition(
                () => daemon.output.some(line => 
                    line.includes("phase:\"plan\"") ||
                    line.includes("Routing decision") && line.includes("plan") ||
                    line.includes("Phase transition") && line.includes("plan") ||
                    line.includes("plan phase")
                ),
                30000,
                1000,
                "Plan phase trigger"
            );
            console.log("✅ Plan phase triggered");

            // Wait a bit for plan to be created
            await setTimeout(10000);

            // Step 7: Check if we're still connected and approve the plan
            console.log("\n📝 Approving the plan and requesting implementation...");
            
            // Send approval message
            chatProcess.process.stdin?.write("@agent Great plan! Please proceed with the implementation and execute it.\n");
            
            // Wait for execute phase
            console.log("\n⏳ Waiting for execute phase and Claude Code...");
            
            let claudeCodeStarted = false;
            let claudeCodeCompleted = false;
            const claudeTimeout = 120000; // 2 minutes
            const startTime = Date.now();

            while (Date.now() - startTime < claudeTimeout) {
                // Check for execute phase transition
                if (daemon.output.some(line => 
                    line.includes("phase:\"execute\"") ||
                    line.includes("Routing decision") && line.includes("execute") ||
                    line.includes("Phase transition") && line.includes("execute") ||
                    line.includes("execute phase")
                )) {
                    console.log("✅ Execute phase triggered");
                }

                // Check for Claude Code initialization
                if (!claudeCodeStarted && daemon.output.some(line => 
                    line.includes("Spawning Claude Code") ||
                    line.includes("ClaudeCodeExecutor") ||
                    line.includes("Triggering Claude Code CLI") ||
                    line.includes("claude code")
                )) {
                    claudeCodeStarted = true;
                    console.log("✅ Claude Code execution started");
                }

                // Check for completion
                if (daemon.output.some(line => 
                    line.includes("Claude Code execution completed") ||
                    line.includes("Execute phase completed") ||
                    line.includes("implementation complete")
                )) {
                    claudeCodeCompleted = true;
                    console.log("✅ Claude Code execution completed");
                    break;
                }

                await setTimeout(1000);
            }

            // Step 8: Verify results
            console.log("\n🔍 Verifying results...");
            
            // Find the project directory
            const projectPathMatch = daemon.output.find(line => 
                line.includes("projectPath")
            )?.match(/projectPath['":s]+([^"',}]+)/);
            
            let filesCreated = false;
            if (projectPathMatch) {
                const projectPath = projectPathMatch[1];
                console.log(`📂 Checking project directory: ${projectPath}`);
                
                try {
                    const files = await fs.readdir(projectPath);
                    console.log(`Files in project: ${files.join(", ")}`);
                    
                    // Check for expected files
                    const jsFiles = files.filter(f => f.endsWith('.js'));
                    filesCreated = jsFiles.length > 0;
                    
                    if (filesCreated) {
                        console.log(`✅ Found JavaScript files: ${jsFiles.join(", ")}`);
                        
                        // Read and display the files
                        for (const file of jsFiles) {
                            const content = await fs.readFile(path.join(projectPath, file), "utf-8");
                            console.log(`\n📄 ${file} content:`);
                            console.log("-------------------");
                            console.log(content);
                            console.log("-------------------");
                        }
                    }
                } catch (err) {
                    console.log(`⚠️  Could not read project directory: ${err}`);
                }
            }

            // Summary
            console.log("\n✨ Claude Code Trigger Test Summary:");
            console.log("====================================");
            console.log(`✅ Workspace created`);
            console.log(`✅ Daemon started`);
            console.log(`✅ Project created and started`);
            console.log(`✅ Chat session connected`);
            console.log(`✅ Plan phase triggered`);
            console.log(`${claudeCodeStarted ? "✅" : "❌"} Claude Code execution started`);
            console.log(`${claudeCodeCompleted ? "✅" : "❌"} Claude Code execution completed`);
            console.log(`${filesCreated ? "✅" : "❌"} Files created by Claude Code`);

            const success = claudeCodeStarted && filesCreated;
            
            if (success) {
                console.log("\n🎉 Claude Code was successfully triggered and executed!");
            } else {
                console.log("\n⚠️  Test completed but Claude Code may not have fully executed");
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
    const test = new TriggerClaudeCodeTest();
    test.run()
        .then((success) => process.exit(success ? 0 : 1))
        .catch((error) => {
            console.error("\n❌ Test failed with error:", error);
            process.exit(1);
        });
}