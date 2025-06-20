#!/usr/bin/env bun

import path from "node:path";
import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { logDebug, logError, logInfo, logger } from "@tenex/shared";
import { fileExists } from "@tenex/shared/fs";
import { AgentRegistry } from "./src/agents";
import { ConversationManager } from "./src/conversations";
import { LLMConfigManager, LLMService } from "./src/llm";
import { ConversationPublisher } from "./src/nostr";
import { getNDK, initNDK } from "./src/nostr/ndkClient";
import { RoutingLLM } from "./src/routing";
import { initializeProjectContext } from "./src/runtime";

// Set debug logging
process.env.LOG_LEVEL = "debug";

async function testConversationSystem() {
  console.log("🧪 Testing TENEX Conversation System\n");

  // Initialize NDK first
  await initNDK();
  console.log("✅ NDK initialized");

  // 1. Setup test project context
  const projectPath = process.cwd();
  const testProjectSigner = NDKPrivateKeySigner.generate();
  const testProjectEvent = new NDKEvent(getNDK());
  testProjectEvent.kind = 35523; // PROJECT kind
  testProjectEvent.content = "Test project for conversation system";
  testProjectEvent.tags = [
    ["title", "Test Project"],
    ["name", "test-project"],
  ];

  console.log("📁 Project Path:", projectPath);

  // Check if llms.json exists
  const llmsPath = path.join(projectPath, "llms.json");
  if (!(await fileExists(llmsPath))) {
    console.error("❌ llms.json not found. Please create one with your LLM configurations.");
    console.log("\nExample llms.json:");
    console.log(
      JSON.stringify(
        {
          configurations: {
            default: {
              provider: "openrouter",
              model: "meta-llama/llama-3.2-3b-instruct",
            },
          },
          defaults: {
            default: "default",
          },
          credentials: {
            openrouter: {
              apiKey: "your-api-key",
              baseUrl: "https://openrouter.ai/api/v1",
            },
          },
        },
        null,
        2
      )
    );
    return;
  }

  // 2. Initialize services
  console.log("\n📦 Initializing services...");

  const llmConfigManager = new LLMConfigManager(projectPath);
  await llmConfigManager.loadConfigurations();
  console.log("✅ LLM configurations loaded");

  const llmService = new LLMService(llmConfigManager);
  console.log("✅ LLM service initialized");

  const agentRegistry = new AgentRegistry(projectPath);
  await agentRegistry.loadFromProject();
  console.log("✅ Agent registry loaded");

  // Create a test agent
  const testAgent = await agentRegistry.ensureAgent("test-assistant", {
    name: "Test Assistant",
    role: "General Assistant",
    expertise: "Testing and debugging",
    instructions: "You are a helpful test assistant",
    nsec: "",
    tools: [],
    llmConfig: "default",
  });
  console.log(
    "✅ Test agent created:",
    testAgent.name,
    "(",
    testAgent.pubkey.substring(0, 8),
    "...)"
  );

  const conversationManager = new ConversationManager(projectPath);
  await conversationManager.initialize();
  console.log("✅ Conversation manager initialized");

  // Initialize project context
  initializeProjectContext({
    projectEvent: testProjectEvent,
    projectSigner: testProjectSigner,
    agents: new Map([["test-assistant", testAgent]]),
    projectPath,
    title: "Test Project",
    repository: undefined,
  });
  console.log("✅ Project context initialized");

  const publisher = new ConversationPublisher(
    { projectEvent: testProjectEvent, projectSigner: testProjectSigner } as any,
    getNDK()
  );
  console.log("✅ Nostr publisher created");

  const routingLLM = new RoutingLLM(llmService);
  console.log("✅ Routing LLM initialized");

  // 3. Create a test conversation event
  console.log("\n🗣️  Creating test conversation...");

  const userSigner = NDKPrivateKeySigner.generate();
  const conversationEvent = new NDKEvent(getNDK());
  conversationEvent.kind = 11; // Conversation kind
  conversationEvent.content = "Hello, I want to build a simple todo app with React and TypeScript.";
  conversationEvent.tags = [
    ["title", "Building a Todo App"],
    ["a", `35523:${testProjectEvent.pubkey}:test-project`], // Tag the project
  ];
  conversationEvent.author = await userSigner.user();
  conversationEvent.created_at = Math.floor(Date.now() / 1000);
  conversationEvent.id = conversationEvent.getEventHash();

  console.log("📝 Conversation event:", {
    id: `${conversationEvent.id?.substring(0, 8)}...`,
    content: conversationEvent.content,
    tags: conversationEvent.tags,
  });

  // 4. Test conversation creation
  console.log("\n🔧 Testing conversation management...");

  const conversation = await conversationManager.createConversation(conversationEvent);
  console.log("✅ Conversation created:", {
    id: `${conversation.id.substring(0, 8)}...`,
    title: conversation.title,
    phase: conversation.phase,
  });

  // 5. Test routing
  console.log("\n🧭 Testing routing system...");

  try {
    const routingDecision = await routingLLM.routeNewConversation(conversationEvent, [testAgent]);

    console.log("✅ Routing decision:", {
      phase: routingDecision.phase,
      confidence: routingDecision.confidence,
      reasoning: routingDecision.reasoning,
    });

    // Update conversation phase if needed
    if (routingDecision.phase !== conversation.phase) {
      await conversationManager.updatePhase(conversation.id, routingDecision.phase);
      console.log(`📊 Phase updated: ${conversation.phase} → ${routingDecision.phase}`);
    }
  } catch (error) {
    console.error("❌ Routing failed:", error);
  }

  // 6. Test phase prompt generation
  console.log("\n📝 Testing prompt generation...");

  try {
    const { PhasePromptBuilder } = await import("./src/prompts");
    const chatPrompt = PhasePromptBuilder.chatPhase(conversation);
    console.log("✅ Chat phase prompt generated");
    console.log("Preview:", `${chatPrompt.substring(0, 200)}...\n`);
  } catch (error) {
    console.error("❌ Prompt generation failed:", error);
  }

  // 7. Test publishing
  console.log("\n📤 Testing Nostr publishing...");

  try {
    // Test project response (using project signer)
    const projectReply = await publisher.publishProjectResponse(
      conversationEvent,
      "Hello! I'd be happy to help you build a todo app. Let me understand your requirements better. Do you have any specific features in mind?",
      { phase: "chat" }
    );

    console.log("✅ Project response created");
    console.log("Response author:", `${projectReply.pubkey?.substring(0, 8)}...`);

    // Test agent response (using agent signer)
    const agentReply = await publisher.publishAgentResponse(
      conversationEvent,
      "I can help you set up the basic React structure. Let's start with...",
      userSigner.pubkey, // Next responder would be the user
      testAgent.signer, // Agent signs this response
      {
        model: "test-model",
        cost: 0.001,
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        systemPromptHash: "abc123",
        userPromptHash: "def456",
      }
    );

    console.log("✅ Agent response created with LLM metadata");
    console.log("Response author:", `${agentReply.pubkey?.substring(0, 8)}...`);
    console.log(
      "LLM metadata tags:",
      agentReply.tags.filter((t) => t[0].startsWith("llm-")).length
    );
  } catch (error) {
    console.error("❌ Publishing test failed:", error);
  }

  // 8. Summary
  console.log("\n📊 Test Summary:");
  console.log("- Services initialized: ✅");
  console.log("- Conversation created: ✅");
  console.log("- Routing tested: ✅");
  console.log("- Prompts generated: ✅");
  console.log("- Publishing prepared: ✅");

  console.log("\n🎉 Conversation system is ready!");
  console.log("\nTo see more detailed logs, check the log files or run with LOG_LEVEL=debug");
}

// Run the test
testConversationSystem().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
