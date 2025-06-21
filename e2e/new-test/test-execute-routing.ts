#!/usr/bin/env bun

import { RoutingLLM } from "../../tenex/src/routing/RoutingLLM";
import { LLMService } from "../../tenex/src/llm/LLMService";
import { LLMConfigManager } from "../../tenex/src/llm/ConfigManager";
import type { Agent } from "../../tenex/src/types/agent";
import type { ConversationState } from "../../tenex/src/conversations/types";
import { logger } from "@tenex/shared";

async function testExecuteRouting() {
  // Initialize LLM service
  const configManager = new LLMConfigManager(process.cwd());
  await configManager.loadConfigurations();
  const llmService = new LLMService(configManager);
  const routingLLM = new RoutingLLM(llmService);

  // Create test agents
  const testAgents: Agent[] = [
    {
      pubkey: "dev1",
      name: "Developer Agent",
      role: "Developer",
      expertise: "TypeScript, Node.js, React",
      created_at: 0,
      tags: [],
      llmConfigs: [],
    },
    {
      pubkey: "arch1",
      name: "Architect Agent",
      role: "Architect",
      expertise: "System design, architecture patterns",
      created_at: 0,
      tags: [],
      llmConfigs: [],
    },
  ];

  // Test 1: Direct implementation request (should route to execute phase)
  console.log("\n=== Test 1: Direct Implementation Request ===");
  const implementationEvent = {
    id: "test1",
    pubkey: "user1",
    created_at: Date.now(),
    kind: 1,
    tags: [],
    content: "Build a REST API endpoint for user registration with email validation",
    sig: "fake-sig",
  } as any;

  const result1 = await routingLLM.routeNewConversation(implementationEvent, testAgents);
  console.log("Result:", JSON.stringify(result1, null, 2));

  // Test 2: Request that needs planning first
  console.log("\n=== Test 2: Complex Request Needing Planning ===");
  const complexEvent = {
    id: "test2",
    pubkey: "user1",
    created_at: Date.now(),
    kind: 1,
    tags: [],
    content: "I want to build a real-time collaborative document editor like Google Docs",
    sig: "fake-sig",
  } as any;

  const result2 = await routingLLM.routeNewConversation(complexEvent, testAgents);
  console.log("Result:", JSON.stringify(result2, null, 2));

  // Test 3: Phase transition from plan to execute
  console.log("\n=== Test 3: Phase Transition from Plan to Execute ===");
  const planConversation: ConversationState = {
    id: "conv1",
    title: "Build REST API",
    phase: "plan",
    participants: ["user1", "arch1"],
    currentAgent: "arch1",
    history: [],
    metadata: {
      plan_summary: "REST API with Express.js, input validation, JWT auth",
    },
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const transitionResult = await routingLLM.routeNextAction(
    planConversation,
    "The plan looks good. Let's implement it now.",
    testAgents
  );
  console.log("Transition Result:", JSON.stringify(transitionResult, null, 2));

  // Test 4: Clear implementation instruction
  console.log("\n=== Test 4: Clear Implementation Instruction ===");
  const clearImplEvent = {
    id: "test4",
    pubkey: "user1",
    created_at: Date.now(),
    kind: 1,
    tags: [],
    content: "Implement a fibonacci function in TypeScript that uses memoization for performance",
    sig: "fake-sig",
  } as any;

  const result4 = await routingLLM.routeNewConversation(clearImplEvent, testAgents);
  console.log("Result:", JSON.stringify(result4, null, 2));
}

// Run the test
testExecuteRouting().catch(console.error);