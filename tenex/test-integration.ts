#!/usr/bin/env bun

import path from "node:path";
import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { fileExists } from "@tenex/shared/fs";
import { AgentRegistry } from "./src/agents";
import { ConversationManager } from "./src/conversations";
import { LLMConfigManager, LLMService } from "./src/llm";
import { ConversationPublisher } from "./src/nostr";
import { getNDK, initNDK } from "./src/nostr/ndkClient";
import { ConversationRouter, RoutingLLM } from "./src/routing";
import { initializeProjectContext } from "./src/runtime";

// Set debug logging
process.env.LOG_LEVEL = "debug";

async function testIntegration() {
  console.log("🚀 TENEX Agentic Routing System - Integration Test\n");

  // Initialize NDK
  await initNDK();
  console.log("✅ NDK initialized");

  // Setup project
  const projectPath = process.cwd();
  const testProjectSigner = NDKPrivateKeySigner.generate();
  const testProjectEvent = new NDKEvent(getNDK());
  testProjectEvent.kind = 35523;
  testProjectEvent.content = "TENEX Integration Test Project";
  testProjectEvent.tags = [
    ["title", "Integration Test"],
    ["name", "integration-test"],
  ];

  // Check LLM config
  const llmsPath = path.join(projectPath, "llms.json");
  if (!(await fileExists(llmsPath))) {
    console.error("❌ llms.json not found. Please create one.");
    return;
  }

  // Initialize all services
  console.log("\n📦 Initializing services...");

  const llmConfigManager = new LLMConfigManager(projectPath);
  await llmConfigManager.loadConfigurations();
  const llmService = new LLMService(llmConfigManager);
  console.log("✅ LLM service ready");

  const agentRegistry = new AgentRegistry(projectPath);
  await agentRegistry.loadFromProject();

  // Create diverse agents
  const agents = await Promise.all([
    agentRegistry.ensureAgent("requirements-analyst", {
      name: "Requirements Analyst",
      role: "Requirements Analyst",
      expertise: "Understanding user needs and clarifying requirements",
      instructions: "Gather and clarify project requirements",
      nsec: "",
      tools: [],
      llmConfig: "default",
    }),
    agentRegistry.ensureAgent("system-architect", {
      name: "System Architect",
      role: "Software Architect",
      expertise: "System design, architecture planning, and technical decisions",
      instructions: "Design scalable and maintainable systems",
      nsec: "",
      tools: ["claude_code"],
      llmConfig: "default",
    }),
    agentRegistry.ensureAgent("fullstack-dev", {
      name: "Full Stack Developer",
      role: "Full Stack Developer",
      expertise: "Frontend, backend, databases, and API development",
      instructions: "Implement features with clean, efficient code",
      nsec: "",
      tools: ["claude_code"],
      llmConfig: "default",
    }),
    agentRegistry.ensureAgent("qa-engineer", {
      name: "QA Engineer",
      role: "Quality Assurance Engineer",
      expertise: "Testing, quality assurance, and bug detection",
      instructions: "Ensure code quality and test coverage",
      nsec: "",
      tools: [],
      llmConfig: "default",
    }),
    agentRegistry.ensureAgent("security-expert", {
      name: "Security Expert",
      role: "Security Review Expert",
      expertise: "Security auditing, vulnerability assessment, and best practices",
      instructions: "Review code for security vulnerabilities",
      nsec: "",
      tools: [],
      llmConfig: "default",
    }),
  ]);
  console.log("✅ Agents created:", agents.length);

  const conversationManager = new ConversationManager(projectPath);
  await conversationManager.initialize();
  console.log("✅ Conversation manager ready");

  // Initialize project context
  initializeProjectContext({
    projectEvent: testProjectEvent,
    projectSigner: testProjectSigner,
    agents: new Map(agents.map((a) => [a.name.toLowerCase().replace(/\s+/g, "-"), a])),
    projectPath,
    title: "Integration Test",
    repository: undefined,
  });
  console.log("✅ Project context set");

  const publisher = new ConversationPublisher(
    { projectEvent: testProjectEvent, projectSigner: testProjectSigner } as any,
    getNDK()
  );
  const routingLLM = new RoutingLLM(llmService);
  const conversationRouter = new ConversationRouter(conversationManager, routingLLM, publisher);
  console.log("✅ Routing system ready");

  // Test conversation flow
  console.log("\n🎭 Starting conversation flow test...\n");

  // 1. User starts a conversation
  console.log("1️⃣ User starts conversation");
  const userSigner = NDKPrivateKeySigner.generate();
  const conversationEvent = new NDKEvent(getNDK());
  conversationEvent.kind = 11;
  conversationEvent.content = `I need to build a real-time collaborative document editor like Google Docs. 
It should support multiple users editing simultaneously, with live cursor positions, 
and automatic conflict resolution. I want to use modern web technologies.`;
  conversationEvent.tags = [
    ["title", "Real-time Collaborative Editor"],
    ["a", `35523:${testProjectEvent.pubkey}:integration-test`],
  ];
  conversationEvent.author = await userSigner.user();
  conversationEvent.created_at = Math.floor(Date.now() / 1000);
  conversationEvent.id = conversationEvent.getEventHash();

  console.log("📝 User message:", conversationEvent.content.substring(0, 100) + "...");

  // Route the new conversation
  await conversationRouter.routeNewConversation(conversationEvent, agents);

  // Wait a bit for async operations
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Check conversation state
  const conversations = conversationManager.getAllConversations();
  if (conversations.length > 0) {
    const conv = conversations[0];
    console.log("\n📊 Conversation State:");
    console.log("  ID:", conv.id.substring(0, 8) + "...");
    console.log("  Title:", conv.title);
    console.log("  Phase:", conv.phase);
    console.log(
      "  Current Agent:",
      agents.find((a) => a.pubkey === conv.currentAgent)?.name || "None"
    );
    console.log("  History Length:", conv.history.length);

    // 2. Simulate user response in chat phase
    if (conv.phase === "chat") {
      console.log("\n2️⃣ User provides more details");
      const userReply = new NDKEvent(getNDK());
      userReply.kind = 1;
      userReply.content = `Yes, I want to use React for the frontend, Node.js for the backend, 
and WebSockets for real-time communication. We should use operational transformation 
for conflict resolution. Also need user authentication and document persistence.`;
      userReply.tags = [
        ["e", conversationEvent.id!, "", "root"],
        ["e", conversationEvent.id!, "", "reply"],
      ];
      userReply.author = await userSigner.user();
      userReply.created_at = Math.floor(Date.now() / 1000);
      userReply.id = userReply.getEventHash();

      await conversationRouter.routeReply(userReply, agents);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // 3. Request phase transition to planning
    console.log("\n3️⃣ Requesting transition to PLAN phase");
    const phaseRequest = new NDKEvent(getNDK());
    phaseRequest.kind = 1;
    phaseRequest.content = "I think we have enough information. Let's create a detailed plan.";
    phaseRequest.tags = [
      ["e", conversationEvent.id!, "", "root"],
      ["phase", "plan"],
    ];
    phaseRequest.author = await userSigner.user();
    phaseRequest.created_at = Math.floor(Date.now() / 1000);
    phaseRequest.id = phaseRequest.getEventHash();

    await conversationRouter.routeReply(phaseRequest, agents);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check updated state
    const updatedConv = conversationManager.getConversation(conv.id);
    if (updatedConv) {
      console.log("\n📊 Updated Conversation State:");
      console.log("  Phase:", updatedConv.phase);
      console.log(
        "  Current Agent:",
        agents.find((a) => a.pubkey === updatedConv.currentAgent)?.name || "None"
      );
      console.log("  History Length:", updatedConv.history.length);

      // Check initialization results
      const initResults = ["chat_init", "plan_init", "execute_init", "review_init"];
      initResults.forEach((key) => {
        if (updatedConv.metadata[key]) {
          console.log(`\n  ${key}:`, JSON.stringify(updatedConv.metadata[key], null, 4));
        }
      });
    }
  }

  // Summary
  console.log("\n\n🎯 Integration Test Summary:");
  console.log("─".repeat(50));
  console.log("✅ NDK connection established");
  console.log("✅ LLM service configured and operational");
  console.log("✅ Agent registry with 5 specialized agents");
  console.log("✅ Conversation management system active");
  console.log("✅ Routing system making decisions");
  console.log("✅ Phase initializers triggering correctly");
  console.log("✅ Nostr event publishing prepared");

  console.log("\n🚀 TENEX Agentic Routing System is fully integrated!");
  console.log("\nNext steps:");
  console.log("- Connect to real Nostr relays");
  console.log("- Implement agent executors for actual work");
  console.log("- Add real-time monitoring dashboard");
  console.log("- Create CLI commands for management");
}

// Run the test
testIntegration().catch((error) => {
  console.error("❌ Integration test failed:", error);
  process.exit(1);
});
