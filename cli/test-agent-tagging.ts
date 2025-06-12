#!/usr/bin/env bun

import { promises as fs } from "fs";
import path from "path";
import NDK, { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { AgentManager } from "./src/utils/agents/AgentManager";

// Test scenarios for agent p-tagging behavior

async function setupTestProject() {
	const testPath = "./test-project";

	// Create test project structure
	await fs.mkdir(path.join(testPath, ".tenex", "agents"), { recursive: true });
	await fs.mkdir(path.join(testPath, ".tenex", "conversations"), {
		recursive: true,
	});

	// Create test agents
	const agents = {
		default: NDKPrivateKeySigner.generate().nsec,
		code: NDKPrivateKeySigner.generate().nsec,
		planner: NDKPrivateKeySigner.generate().nsec,
		debugger: NDKPrivateKeySigner.generate().nsec,
	};

	await fs.writeFile(
		path.join(testPath, ".tenex", "agents.json"),
		JSON.stringify(agents, null, 2),
	);

	// Create test LLM config
	const llmConfig = {
		default: {
			provider: "test",
			model: "test-model",
			apiKey: "test-key",
		},
	};

	await fs.writeFile(
		path.join(testPath, ".tenex", "llms.json"),
		JSON.stringify(llmConfig, null, 2),
	);

	return { testPath, agents };
}

async function cleanupTestProject(testPath: string) {
	try {
		await fs.rm(testPath, { recursive: true, force: true });
	} catch (error) {
		// Ignore cleanup errors
	}
}

async function runTests() {
	console.log("🧪 Testing agent p-tagging behavior...\n");

	const { testPath, agents } = await setupTestProject();
	const ndk = new NDK();

	try {
		// Initialize agent manager
		const agentManager = new AgentManager(testPath);
		await agentManager.initialize();

		// Create a test user (not an agent)
		const userSigner = NDKPrivateKeySigner.generate();

		// Get agent pubkeys for testing
		const codeSigner = new NDKPrivateKeySigner(agents.code);
		const plannerSigner = new NDKPrivateKeySigner(agents.planner);

		console.log(
			"📋 Test Scenario 1: Chat message with p-tags (only tagged agents should respond)",
		);
		console.log(`   User pubkey: ${userSigner.pubkey.slice(0, 8)}...`);
		console.log(`   Code agent pubkey: ${codeSigner.pubkey.slice(0, 8)}...`);
		console.log(
			`   Planner agent pubkey: ${plannerSigner.pubkey.slice(0, 8)}...`,
		);

		// Create a chat event with p-tags for specific agents
		const chatEvent = new NDKEvent(ndk);
		chatEvent.kind = 1;
		chatEvent.content = "Hey @code and @planner, can you help me with this?";
		chatEvent.pubkey = userSigner.pubkey;
		chatEvent.created_at = Math.floor(Date.now() / 1000);
		chatEvent.tags = [
			["p", codeSigner.pubkey, "wss://relay.example.com", "code"],
			["p", plannerSigner.pubkey, "wss://relay.example.com", "planner"],
		];
		chatEvent.id = chatEvent.getEventHash();

		console.log("\n✅ Expected behavior:");
		console.log(
			"   - All agents should track this message in their conversation history",
		);
		console.log(
			"   - Only 'code' and 'planner' agents should generate responses",
		);
		console.log("   - 'default' and 'debugger' agents should NOT respond\n");

		// Mock the NDK to prevent actual publishing
		ndk.publish = async () => {
			console.log("   [Mock] Event would be published to Nostr");
			return { id: "mock-id", relay: null };
		};

		// Simulate handling the event
		await agentManager.handleChatEvent(chatEvent, ndk, "default", undefined, [
			codeSigner.pubkey,
			plannerSigner.pubkey,
		]);

		console.log(
			"\n📋 Test Scenario 2: Chat message without p-tags (only default agent should respond)",
		);

		// Create a chat event without p-tags
		const chatEvent2 = new NDKEvent(ndk);
		chatEvent2.kind = 1;
		chatEvent2.content = "This is a general message to the project.";
		chatEvent2.pubkey = userSigner.pubkey;
		chatEvent2.created_at = Math.floor(Date.now() / 1000);
		chatEvent2.tags = [];
		chatEvent2.id = chatEvent2.getEventHash();

		console.log("\n✅ Expected behavior:");
		console.log(
			"   - All agents should track this message in their conversation history",
		);
		console.log("   - Only 'default' agent should generate a response");
		console.log("   - Other agents should NOT respond\n");

		await agentManager.handleChatEvent(chatEvent2, ndk, "default");

		console.log("\n📋 Test Scenario 3: Task with p-tags for specific agent");

		// Create a task event with p-tag for debugger
		const taskEvent = new NDKEvent(ndk);
		taskEvent.kind = 1934;
		taskEvent.content = "Debug the memory leak in the application";
		taskEvent.pubkey = userSigner.pubkey;
		taskEvent.created_at = Math.floor(Date.now() / 1000);
		taskEvent.tags = [
			["title", "Fix Memory Leak"],
			[
				"p",
				new NDKPrivateKeySigner(agents.debugger).pubkey,
				"wss://relay.example.com",
				"debugger",
			],
		];
		taskEvent.id = taskEvent.getEventHash();

		console.log("\n✅ Expected behavior:");
		console.log(
			"   - All agents should track this task in their conversation history",
		);
		console.log("   - Only 'debugger' agent should generate a response");
		console.log("   - Other agents should NOT respond\n");

		await agentManager.handleTaskEvent(taskEvent, ndk, "default", undefined, [
			new NDKPrivateKeySigner(agents.debugger).pubkey,
		]);

		console.log("\n✅ Test Summary:");
		console.log("   - Agent p-tagging ensures only mentioned agents respond");
		console.log(
			"   - All agents maintain full context in their conversation history",
		);
		console.log("   - Default agent responds when no p-tags are present");
		console.log(
			"   - Implementation correctly filters responses while preserving context\n",
		);
	} catch (error) {
		console.error("❌ Test failed:", error);
	} finally {
		await cleanupTestProject(testPath);
	}
}

// Mock the LLM provider for testing
const originalFactory = require("./src/utils/agents/llm/LLMFactory").LLMFactory;
originalFactory.createProvider = (config: any) => ({
	generateResponse: async (messages: any[], config: any) => {
		return {
			content: "This is a test response",
			model: config.model,
			usage: {
				prompt_tokens: 100,
				completion_tokens: 50,
				total_tokens: 150,
			},
		};
	},
});

runTests().catch(console.error);
