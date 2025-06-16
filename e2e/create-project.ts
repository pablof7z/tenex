#!/usr/bin/env bun

import { spawn, type ChildProcess } from "child_process";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import path from "path";
import fs from "fs";
import { setTimeout } from "timers/promises";

const TENEX_PATH = path.join(__dirname, "..", "tenex", "bin", "tenex.ts");
const CLI_CLIENT_PATH = path.join(__dirname, "..", "cli-client", "dist", "index.js");
const TEST_TIMEOUT = 60000; // 60 seconds

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
    env: { ...process.env, FORCE_COLOR: "0" }
  });
  
  const info: ProcessInfo = {
    process: child,
    output: [],
    errors: []
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
  timeout: number = 10000,
  interval: number = 100
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
  const buildResult = await runCommand("bun", ["run", "build"], {
    cwd: path.join(__dirname, "..", "cli-client")
  });
  console.log("✅ CLI client built successfully");
}

async function runE2ETest() {
  console.log("🚀 Starting E2E test for project creation and startup");
  
  let daemon: ProcessInfo | undefined;
  
  try {
    // Build cli-client first
    await buildCliClient();
    
    // 1. Generate new Nostr key
    const signer = NDKPrivateKeySigner.generate();
    const pubkey = signer.pubkey;
    const nsec = signer.privateKey!;
    
    console.log(`\n📝 Generated new user with pubkey: ${pubkey}`);
    
    // 2. Start daemon with the new user's pubkey as whitelist
    console.log("\n🎯 Starting daemon with whitelisted pubkey...");
    daemon = startProcess("bun", [TENEX_PATH, "daemon", "--whitelist", pubkey]);
    
    // Wait for daemon to be ready
    await waitForCondition(
      () => daemon!.output.some(line => 
        line.includes("daemon is running") || 
        line.includes("Event monitor started") ||
        line.includes("Monitoring events") ||
        line.includes("Listening for events")
      ),
      15000
    );
    console.log("✅ Daemon started successfully");
    
    // 3. Create project via cli-client
    const projectName = `Test Project ${Date.now()}`;
    
    console.log(`\n📦 Creating project: ${projectName}`);
    
    const createResult = await runCommand("bun", [
      CLI_CLIENT_PATH,
      "project", "create",
      "--name", projectName,
      "--nsec", nsec,  // privateKey is already in hex format
      "--description", "E2E test project",
      "--hashtags", "test,e2e"
    ]);
    
    // Extract NADDR from output
    const naddrMatch = createResult.stdout.match(/NADDR: (naddr1[a-zA-Z0-9]+)/);
    if (!naddrMatch) {
      throw new Error("Failed to extract NADDR from project creation output");
    }
    const projectNaddr = naddrMatch[1];
    console.log(`✅ Project created with NADDR: ${projectNaddr}`);
    
    // 4. Send project start event
    console.log("\n📡 Sending project start event...");
    
    await runCommand("bun", [
      CLI_CLIENT_PATH,
      "project", "start",
      "--nsec", nsec,  // privateKey is already in hex format
      "--project", projectNaddr
    ]);
    
    console.log("✅ Project start event sent");
    
    // 5. Wait for daemon to detect the project and start tenex run
    console.log("\n⏳ Waiting for daemon to start project process...");
    await waitForCondition(
      () => daemon!.output.some(line => 
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
      () => daemon!.output.some(line => 
        line.includes("Ready to process events") || // Project is ready
        line.includes("Project listener active") ||
        line.includes('"status":"online"') || // Status event content
        line.includes("Publishing status")
      ),
      30000
    );
    console.log("✅ Project is online!");
    
    // 7. Verify the test passed
    console.log("\n✨ E2E Test Summary:");
    console.log("- ✅ Generated new Nostr identity");
    console.log("- ✅ Started daemon with whitelist");
    console.log("- ✅ Created project via cli-client");
    console.log("- ✅ Sent project start event");
    console.log("- ✅ Daemon detected and started project");
    console.log("- ✅ Project came online");
    
    console.log("\n🎉 E2E test completed successfully!");
    
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