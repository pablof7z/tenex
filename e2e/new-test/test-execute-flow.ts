#!/usr/bin/env bun

import { ExecutePhaseInitializer } from "../../tenex/src/phases/ExecutePhaseInitializer";
import type { ConversationState } from "../../tenex/src/conversations/types";
import type { Agent } from "../../tenex/src/types/agent";
import { logger } from "@tenex/shared";
import { initializeProjectContext } from "../../tenex/src/runtime/ProjectContext";
import type { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import NDK from "@nostr-dev-kit/ndk";

// Mock the project context
const mockProjectContext = {
  projectPath: process.cwd(),
  projectDir: process.cwd(),
  projectEvent: {
    id: "test-project",
    pubkey: "test-project-pubkey",
    created_at: Date.now(),
    kind: 31337,
    tags: [],
    content: "Test Project",
    sig: "fake-sig",
  } as NDKEvent,
  projectSigner: {
    privateKey: "test-key",
    pubkey: () => "test-pubkey",
  } as any as NDKPrivateKeySigner,
  ndk: new NDK(),
  agents: new Map(),
  title: "Test Project",
} as any;

initializeProjectContext(mockProjectContext);

async function testExecuteFlow() {
  console.log("\n=== Testing Execute Phase Initialization ===");

  const executeInitializer = new ExecutePhaseInitializer();

  // Create a test conversation in plan phase with a plan
  const conversation: ConversationState = {
    id: "conv-execute-test",
    title: "Build Fibonacci Function",
    phase: "plan",
    participants: ["user1", "dev1"],
    currentAgent: "dev1",
    history: [
      {
        id: "root-event",
        pubkey: "user1",
        created_at: Date.now(),
        kind: 1,
        tags: [],
        content: "Implement a fibonacci function in TypeScript with memoization",
        sig: "fake-sig",
      } as NDKEvent,
    ],
    metadata: {
      plan_summary: "Create a TypeScript function that calculates Fibonacci numbers using memoization for O(n) time complexity. Include type definitions and unit tests.",
    },
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  // Test agents
  const agents: Agent[] = [
    {
      pubkey: "dev1",
      name: "Developer Agent",
      role: "Developer",
      expertise: "TypeScript, Node.js, React",
      created_at: 0,
      tags: [],
      llmConfigs: [],
    },
  ];

  try {
    const result = await executeInitializer.initialize(conversation, agents);
    console.log("\nInitialization Result:", JSON.stringify(result, null, 2));

    if (result.success) {
      console.log("\n✅ Execute phase initialized successfully!");
      console.log("Metadata:", result.metadata);
    } else {
      console.log("\n❌ Execute phase initialization failed:", result.message);
    }
  } catch (error) {
    console.error("\n❌ Error during initialization:", error);
  }
}

// Run the test
testExecuteFlow().catch(console.error);