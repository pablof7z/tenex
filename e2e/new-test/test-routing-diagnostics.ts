#!/usr/bin/env bun

import { RoutingLLM } from "../../tenex/src/routing/RoutingLLM";
import { LLMService } from "../../tenex/src/llm/LLMService";
import { LLMConfigManager } from "../../tenex/src/llm/ConfigManager";
import type { Agent } from "../../tenex/src/types/agent";
import type { ConversationState } from "../../tenex/src/conversations/types";
import { logger } from "@tenex/shared";

/**
 * Diagnostic test to understand routing decisions
 * 
 * This test simulates the exact conversation flow to see why
 * the execute phase isn't being triggered.
 */
async function testRoutingDiagnostics() {
  console.log("🔍 Routing Diagnostics Test");
  console.log("===========================\n");

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
      expertise: "TypeScript, Node.js, React, Implementation",
      created_at: 0,
      tags: [],
      llmConfigs: [],
    },
    {
      pubkey: "arch1",
      name: "Architect Agent",
      role: "Architect",
      expertise: "System design, architecture patterns, planning",
      created_at: 0,
      tags: [],
      llmConfigs: [],
    },
  ];

  // Scenario 1: Initial conversation (should go to chat)
  console.log("📋 Scenario 1: Initial conversation");
  const initialEvent = {
    id: "test1",
    pubkey: "user1",
    created_at: Date.now(),
    kind: 1,
    tags: [],
    content: "I need a Node.js script that reads numbers from a file and calculates sum and average",
    sig: "fake-sig",
  } as any;

  const result1 = await routingLLM.routeNewConversation(initialEvent, testAgents);
  console.log("Initial routing:", JSON.stringify(result1, null, 2));
  console.log("Expected: chat phase\n");

  // Scenario 2: After requirements gathered, request plan
  console.log("📋 Scenario 2: Request planning after requirements");
  const chatConversation: ConversationState = {
    id: "conv1",
    title: "Node.js calculator script",
    phase: "chat",
    participants: ["user1", "project"],
    currentAgent: "project",
    history: [initialEvent],
    metadata: {
      summary: "User needs a Node.js script to read numbers from file and calculate sum/average"
    },
    created_at: Date.now() - 60000,
    updated_at: Date.now() - 30000,
  };

  const planResult = await routingLLM.routeNextAction(
    chatConversation,
    "The requirements are clear. Let's create a detailed plan for this implementation.",
    testAgents
  );
  console.log("Plan transition result:", JSON.stringify(planResult, null, 2));
  console.log("Expected: plan phase\n");

  // Scenario 3: After plan created, approve and request execution
  console.log("📋 Scenario 3: Approve plan and request execution");
  const planConversation: ConversationState = {
    id: "conv1",
    title: "Node.js calculator script",
    phase: "plan",
    participants: ["user1", "arch1"],
    currentAgent: "arch1",
    history: [initialEvent],
    metadata: {
      summary: "User needs a Node.js script to read numbers from file and calculate sum/average",
      plan_summary: "1. Create readNumbers.js script\n2. Use fs.readFile to read numbers.txt\n3. Parse numbers and calculate sum/average\n4. Write results to results.txt\n5. Add error handling"
    },
    created_at: Date.now() - 120000,
    updated_at: Date.now() - 10000,
  };

  const executeResult = await routingLLM.routeNextAction(
    planConversation,
    "As the architect, I approve this plan. The architecture is solid. Let's proceed with implementation.",
    testAgents
  );
  console.log("Execute transition result:", JSON.stringify(executeResult, null, 2));
  console.log("Expected: execute phase\n");

  // Scenario 4: More explicit execution request
  console.log("📋 Scenario 4: Very explicit execution request");
  const executeResult2 = await routingLLM.routeNextAction(
    planConversation,
    "The plan is approved. Please implement this now. Start coding the solution.",
    testAgents
  );
  console.log("Explicit execute result:", JSON.stringify(executeResult2, null, 2));
  console.log("Expected: execute phase\n");

  // Scenario 5: Using phase tag
  console.log("📋 Scenario 5: Direct phase request");
  const executeResult3 = await routingLLM.routeNextAction(
    planConversation,
    "Execute phase: implement the approved plan",
    testAgents
  );
  console.log("Phase tag result:", JSON.stringify(executeResult3, null, 2));
  console.log("Expected: execute phase\n");

  // Summary
  console.log("\n📊 Routing Diagnostics Summary:");
  console.log("================================");
  console.log("Chat → Plan transition:", planResult.phase === "plan" ? "✅ Working" : "❌ Not working");
  console.log("Plan → Execute transition:", executeResult.phase === "execute" ? "✅ Working" : "❌ Not working");
  
  if (executeResult.phase !== "execute") {
    console.log("\n⚠️  Issue detected: Execute phase not triggering");
    console.log("Possible causes:");
    console.log("1. LLM not recognizing plan approval language");
    console.log("2. Phase transition prompt needs adjustment");
    console.log("3. Business rules preventing transition");
    console.log("\nCheck the routing decision reasoning for clues.");
  }
}

// Run the test
testRoutingDiagnostics().catch(console.error);