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
 * Test for Phase Transitions in TENEX
 * 
 * This test demonstrates the proper flow for phase transitions:
 * 1. Start in chat phase
 * 2. Gather requirements
 * 3. Transition to plan phase
 * 4. Create and approve plan
 * 5. Transition to execute phase (triggers Claude Code)
 */
class PhaseTransitionTest {
    private processes: ProcessInfo[] = [];
    private config: TestConfig;

    constructor() {
        const signer = NDKPrivateKeySigner.generate();
        const timestamp = Date.now();
        
        this.config = {
            nsec: signer.privateKey!,
            npub: signer.pubkey,
            projectName: `Phase Test ${timestamp}`,
            projectId: `phase-test-${timestamp}`,
            workDir: path.join(__dirname, "test-workspace", `phase-${timestamp}`),
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

    async run() {
        console.log("🎯 Starting Phase Transition Test");
        console.log("==================================");

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

            // Step 5: Use debug chat to interact with the system
            console.log("\n💬 Starting debug chat session...");
            const chatProcess = this.startProcess(
                "debug-chat",
                "bun",
                [
                    TENEX_PATH,
                    "debug", "chat",
                    "--project-path", daemon.output.find(line => 
                        line.includes("projectPath")
                    )?.match(/projectPath['":\s]+([^"',}]+)/)?.[1] || this.config.workDir
                ],
                { cwd: this.config.workDir }
            );

            // Wait for chat to be ready
            await setTimeout(3000);

            // Phase 1: Chat - Gather requirements
            console.log("\n📝 Phase 1: CHAT - Gathering requirements...");
            chatProcess.process.stdin?.write(
                "I need a simple Node.js script that:\n" +
                "1. Reads a list of numbers from a file called 'numbers.txt'\n" +
                "2. Calculates the sum and average\n" +
                "3. Writes the results to 'results.txt'\n" +
                "Please confirm these requirements are clear.\n"
            );

            // Wait for chat response
            await this.waitForCondition(
                () => daemon.output.some(line => 
                    line.includes("chat phase") && 
                    line.includes("response")
                ),
                30000,
                1000,
                "Chat phase response"
            );
            console.log("✅ Requirements confirmed in chat phase");

            await setTimeout(3000);

            // Phase 2: Request planning
            console.log("\n📐 Phase 2: Requesting transition to PLAN phase...");
            chatProcess.process.stdin?.write(
                "The requirements look good. Let's create a detailed plan for this implementation.\n"
            );

            // Wait for plan phase to activate
            await this.waitForCondition(
                () => daemon.output.some(line => 
                    line.includes("Phase transition") && 
                    line.includes("to: plan") ||
                    line.includes("plan phase")
                ),
                60000,
                1000,
                "Plan phase activation"
            );
            console.log("✅ Successfully transitioned to plan phase");

            // Wait for plan to be created
            await this.waitForCondition(
                () => daemon.output.some(line => 
                    line.includes("plan_summary") ||
                    line.includes("Plan created") ||
                    line.includes("Architecture") ||
                    line.includes("Implementation plan")
                ),
                60000,
                1000,
                "Plan creation"
            );
            console.log("✅ Plan has been created");

            await setTimeout(5000);

            // Phase 3: Approve plan and request execution
            console.log("\n🔨 Phase 3: Approving plan and requesting EXECUTE phase...");
            chatProcess.process.stdin?.write(
                "As the architect, I approve this plan. The architecture looks solid and meets all requirements. " +
                "Let's proceed with the implementation in the execute phase.\n"
            );

            // Monitor for execute phase activation
            console.log("\n⏳ Waiting for execute phase and Claude Code...");
            
            let executePhaseStarted = false;
            let claudeCodeStarted = false;
            let claudeCodeCompleted = false;
            const executeTimeout = 120000; // 2 minutes
            const startTime = Date.now();

            while (Date.now() - startTime < executeTimeout) {
                // Check for execute phase transition
                if (!executePhaseStarted && daemon.output.some(line => 
                    (line.includes("Phase transition") && line.includes("to: execute")) ||
                    line.includes("execute phase") ||
                    line.includes("ExecutePhaseInitializer")
                )) {
                    executePhaseStarted = true;
                    console.log("✅ Execute phase activated");
                }

                // Check for Claude Code initialization
                if (!claudeCodeStarted && daemon.output.some(line => 
                    line.includes("Spawning Claude Code") ||
                    line.includes("ClaudeCodeExecutor") ||
                    line.includes("Triggering Claude Code CLI")
                )) {
                    claudeCodeStarted = true;
                    console.log("✅ Claude Code execution started");
                }

                // Check for completion
                if (daemon.output.some(line => 
                    line.includes("Claude Code execution completed") ||
                    line.includes("Execute phase completed") ||
                    line.includes("Task Complete")
                )) {
                    claudeCodeCompleted = true;
                    console.log("✅ Claude Code execution completed");
                    break;
                }

                await setTimeout(1000);
            }

            // Step 6: Verify results
            console.log("\n🔍 Verifying results...");
            
            // Find the project directory
            const projectPathMatch = daemon.output.find(line => 
                line.includes("projectPath")
            )?.match(/projectPath['":\s]+([^"',}]+)/);
            
            let filesCreated = false;
            if (projectPathMatch) {
                const projectPath = projectPathMatch[1];
                console.log(`📂 Checking project directory: ${projectPath}`);
                
                try {
                    const files = await fs.readdir(projectPath);
                    console.log(`Files in project: ${files.join(", ")}`);
                    
                    // Check for any new files created
                    filesCreated = files.some(f => 
                        f.endsWith(".js") || 
                        f.endsWith(".txt") || 
                        (f === "package.json" && files.length > 1)
                    );
                    
                    // Read any JavaScript files
                    for (const file of files) {
                        if (file.endsWith(".js")) {
                            const content = await fs.readFile(path.join(projectPath, file), "utf-8");
                            console.log(`\n📄 ${file} content:`);
                            console.log(content);
                        }
                    }
                } catch (err) {
                    console.log(`⚠️  Could not read project directory: ${err}`);
                }
            }

            // Summary
            console.log("\n✨ Phase Transition Test Summary:");
            console.log("===================================");
            console.log(`✅ Workspace created`);
            console.log(`✅ Daemon started`);
            console.log(`✅ Project created and started`);
            console.log(`✅ Chat phase: Requirements gathered`);
            console.log(`✅ Plan phase: Successfully transitioned`);
            console.log(`${executePhaseStarted ? "✅" : "❌"} Execute phase: Activated`);
            console.log(`${claudeCodeStarted ? "✅" : "❌"} Claude Code: Execution started`);
            console.log(`${claudeCodeCompleted ? "✅" : "❌"} Claude Code: Execution completed`);
            console.log(`${filesCreated ? "✅" : "❌"} Files created by Claude Code`);

            const success = executePhaseStarted && (claudeCodeStarted || filesCreated);
            
            if (success) {
                console.log("\n🎉 Phase transition test completed successfully!");
                console.log("The system properly transitioned through chat → plan → execute phases");
            } else {
                console.log("\n⚠️  Test partially successful");
                if (!executePhaseStarted) {
                    console.log("Issue: Execute phase was not activated");
                    console.log("Possible cause: Plan was not properly approved or routing decision failed");
                }
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
    const test = new PhaseTransitionTest();
    test.run()
        .then((success) => process.exit(success ? 0 : 1))
        .catch((error) => {
            console.error("\n❌ Test failed with error:", error);
            process.exit(1);
        });
}