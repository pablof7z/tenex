#!/usr/bin/env bun

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TENEX_PATH = path.join(__dirname, "..", "..", "tenex", "bin", "tenex.ts");
const CLI_CLIENT_PATH = path.join(__dirname, "..", "..", "cli-client", "dist", "index.js");

async function runSimpleTest() {
    console.log("🎯 Running Simple E2E Test");
    
    const signer = NDKPrivateKeySigner.generate();
    const nsec = signer.privateKey!;
    const npub = signer.pubkey;
    const workDir = path.join(__dirname, "simple-test-workspace");
    
    // Setup workspace
    await fs.mkdir(workDir, { recursive: true });
    const tenexDir = path.join(workDir, ".tenex");
    await fs.mkdir(tenexDir, { recursive: true });
    
    // Create LLM config
    const llmConfig = {
        configurations: {
            default: {
                provider: "openrouter",
                model: "deepseek/deepseek-chat-v3-0324"
            }
        },
        defaults: {
            default: "default"
        },
        credentials: {
            openrouter: {
                apiKey: "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",
                baseUrl: "https://openrouter.ai/api/v1"
            }
        }
    };
    
    await fs.writeFile(
        path.join(tenexDir, "llms.json"),
        JSON.stringify(llmConfig, null, 2)
    );
    
    console.log("✅ Setup complete");
    
    // Start daemon
    console.log("\n📡 Starting daemon...");
    const daemon = spawn("bun", [TENEX_PATH, "daemon", "--whitelist", npub], {
        cwd: workDir,
        env: { ...process.env, HOME: workDir }
    });
    
    daemon.stdout?.on("data", (data) => {
        console.log(`[DAEMON] ${data.toString().trim()}`);
    });
    
    daemon.stderr?.on("data", (data) => {
        console.error(`[DAEMON ERROR] ${data.toString().trim()}`);
    });
    
    // Wait for daemon to start
    await setTimeout(5000);
    
    // Create project
    console.log("\n📦 Creating project...");
    const createProcess = spawn("bun", [
        CLI_CLIENT_PATH,
        "project", "create",
        "--name", "Simple Test Project",
        "--nsec", nsec
    ], {
        cwd: workDir,
        env: { ...process.env, HOME: workDir }
    });
    
    let projectNaddr = "";
    
    createProcess.stdout?.on("data", (data) => {
        const output = data.toString();
        console.log(`[CREATE] ${output.trim()}`);
        
        // Extract NADDR
        const match = output.match(/naddr1[a-z0-9]+/);
        if (match && !projectNaddr) {
            projectNaddr = match[0];
        }
    });
    
    createProcess.stderr?.on("data", (data) => {
        console.error(`[CREATE ERROR] ${data.toString().trim()}`);
    });
    
    await new Promise((resolve) => {
        createProcess.on("close", resolve);
    });
    
    console.log(`✅ Project created with NADDR: ${projectNaddr}`);
    
    // Clean up
    console.log("\n🧹 Cleaning up...");
    daemon.kill("SIGTERM");
    await setTimeout(2000);
    
    console.log("✅ Test complete");
}

if (import.meta.main) {
    runSimpleTest().catch(console.error);
}