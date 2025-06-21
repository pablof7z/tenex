#!/usr/bin/env bun

/**
 * Simple test to verify Claude Code can be triggered
 * This test uses the debug chat command which should work more reliably
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TENEX_PATH = path.join(__dirname, "..", "..", "tenex", "bin", "tenex.ts");

async function runTest() {
    console.log("🎯 Simple Claude Code Test");
    console.log("=========================");

    const timestamp = Date.now();
    const workDir = path.join(__dirname, "test-workspace", `simple-${timestamp}`);
    
    // Setup workspace
    console.log("\n📁 Setting up workspace...");
    await fs.mkdir(workDir, { recursive: true });
    
    // Create .tenex directory with LLM config
    const globalTenexDir = path.join(workDir, ".tenex");
    await fs.mkdir(globalTenexDir, { recursive: true });
    
    const llmConfig = {
        configurations: {
            default: {
                provider: "openrouter",
                model: "deepseek/deepseek-chat-v3-0324"
            }
        },
        defaults: {
            default: "default",
            routing: "default",
            agent: "default"
        },
        credentials: {
            openrouter: {
                apiKey: "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",
                baseUrl: "https://openrouter.ai/api/v1"
            }
        }
    };
    
    await fs.writeFile(
        path.join(globalTenexDir, "llms.json"),
        JSON.stringify(llmConfig, null, 2)
    );
    
    // Create a test project directory
    const projectDir = path.join(workDir, "test-project");
    await fs.mkdir(projectDir, { recursive: true });
    
    // Create a simple file to show we're in a project
    await fs.writeFile(
        path.join(projectDir, "README.md"),
        "# Test Project\nThis is a test project for Claude Code integration."
    );
    
    console.log("✅ Workspace created at:", workDir);
    console.log("✅ Project directory at:", projectDir);
    
    // Run debug chat command
    console.log("\n🚀 Starting debug chat...");
    
    const child = spawn("bun", [
        TENEX_PATH,
        "debug", "chat",
        "--project-path", projectDir
    ], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { 
            ...process.env, 
            FORCE_COLOR: "0",
            HOME: workDir
        },
        cwd: projectDir
    });

    let output = "";
    let errors = "";

    child.stdout?.on("data", (data) => {
        const text = data.toString();
        output += text;
        console.log("[DEBUG CHAT]", text.trim());
    });

    child.stderr?.on("data", (data) => {
        const text = data.toString();
        errors += text;
        console.error("[DEBUG CHAT ERROR]", text.trim());
    });

    // Wait for chat to be ready
    await setTimeout(3000);
    
    console.log("\n📝 Sending plan request...");
    
    // Send a message asking for a plan
    child.stdin?.write(
        "Please create a plan for a simple JavaScript hello world application that prints 'Hello from Claude Code!' and includes a test.\n"
    );
    
    // Wait for response
    await setTimeout(10000);
    
    console.log("\n📝 Sending execute request...");
    
    // Ask to execute the plan
    child.stdin?.write(
        "Great! Now please implement the plan using Claude Code.\n"
    );
    
    // Wait for Claude Code to potentially run
    await setTimeout(20000);
    
    // Check if any files were created
    console.log("\n🔍 Checking for created files...");
    
    try {
        const files = await fs.readdir(projectDir);
        console.log("Files in project:", files);
        
        const jsFiles = files.filter(f => f.endsWith('.js'));
        if (jsFiles.length > 0) {
            console.log("✅ Found JavaScript files:", jsFiles);
            
            for (const file of jsFiles) {
                const content = await fs.readFile(path.join(projectDir, file), "utf-8");
                console.log(`\n📄 ${file}:`);
                console.log(content);
            }
        } else {
            console.log("❌ No JavaScript files created");
        }
    } catch (err) {
        console.error("Error checking files:", err);
    }
    
    // Clean up
    console.log("\n🧹 Cleaning up...");
    child.kill("SIGTERM");
    await setTimeout(1000);
    if (!child.killed) {
        child.kill("SIGKILL");
    }
    
    // Save logs
    const logsDir = path.join(workDir, "logs");
    await fs.mkdir(logsDir, { recursive: true });
    
    await fs.writeFile(path.join(logsDir, "output.log"), output);
    if (errors) {
        await fs.writeFile(path.join(logsDir, "errors.log"), errors);
    }
    
    console.log("✅ Logs saved to:", logsDir);
    console.log("\n✨ Test complete!");
}

// Run the test
runTest().catch(error => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
});