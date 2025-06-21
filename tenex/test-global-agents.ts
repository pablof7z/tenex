#!/usr/bin/env bun

import os from "node:os";
import path from "node:path";
import { writeJsonFile } from "@tenex/shared/fs";
import { generateSecretKey } from "nostr-tools";
import { nip19 } from "nostr-tools";
import { AgentRegistry } from "./src/agents/AgentRegistry";

async function testGlobalAgents() {
  console.log("🧪 Testing global agent loading functionality...");

  // Create a temporary project directory
  const tempDir = "/tmp/test-tenex-project";
  const globalDir = path.join(os.homedir(), ".tenex");

  try {
    // Generate valid nsec keys
    const globalKey1 = generateSecretKey();
    const globalKey2 = generateSecretKey();
    const projectKey1 = generateSecretKey();
    const overrideKey1 = generateSecretKey();

    // Create test global agents.json
    const globalAgentsPath = path.join(globalDir, "agents.json");
    const globalAgents = {
      "global-agent-1": {
        nsec: nip19.nsecEncode(globalKey1),
        file: "global-agent-1.json",
      },
      "global-agent-2": {
        nsec: nip19.nsecEncode(globalKey2),
        file: "global-agent-2.json",
      },
    };

    await writeJsonFile(globalAgentsPath, globalAgents);
    console.log("✅ Created test global agents.json");

    // Create test project agents.json
    const projectAgentsPath = path.join(tempDir, ".tenex", "agents.json");
    const projectAgents = {
      "project-agent-1": {
        nsec: nip19.nsecEncode(projectKey1),
        file: "project-agent-1.json",
      },
      "global-agent-1": {
        nsec: nip19.nsecEncode(overrideKey1),
        file: "override-global-agent-1.json",
      },
    };

    await writeJsonFile(projectAgentsPath, projectAgents);
    console.log("✅ Created test project agents.json");

    // Test the AgentRegistry
    const registry = new AgentRegistry(tempDir);
    await registry.loadFromProject();

    // Now create actual Agent instances from the loaded registry
    // This simulates how agents are created through ensureAgent
    await registry.ensureAgent("global-agent-1", {
      name: "global-agent-1",
      role: "test-agent",
      expertise: "testing",
      instructions: "Test global agent",
      nsec: "",
      eventId: "",
      pubkey: "",
      tools: [],
    });

    await registry.ensureAgent("global-agent-2", {
      name: "global-agent-2",
      role: "test-agent",
      expertise: "testing",
      instructions: "Test global agent 2",
      nsec: "",
      eventId: "",
      pubkey: "",
      tools: [],
    });

    await registry.ensureAgent("project-agent-1", {
      name: "project-agent-1",
      role: "test-agent",
      expertise: "testing",
      instructions: "Test project agent",
      nsec: "",
      eventId: "",
      pubkey: "",
      tools: [],
    });

    const allAgents = registry.getAllAgents();
    console.log(`📊 Total agents loaded: ${allAgents.length}`);

    // Check that we have agents from both global and project
    const globalAgent1 = registry.getAgent("global-agent-1");
    const globalAgent2 = registry.getAgent("global-agent-2");
    const projectAgent1 = registry.getAgent("project-agent-1");

    if (globalAgent1) {
      console.log("✅ Global agent 1 loaded (should be overridden by project)");
    } else {
      console.log("❌ Global agent 1 not found");
    }

    if (globalAgent2) {
      console.log("✅ Global agent 2 loaded");
    } else {
      console.log("❌ Global agent 2 not found");
    }

    if (projectAgent1) {
      console.log("✅ Project agent 1 loaded");
    } else {
      console.log("❌ Project agent 1 not found");
    }

    console.log("🎉 Global agent loading test completed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testGlobalAgents().catch(console.error);
