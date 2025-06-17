#!/usr/bin/env bun

/**
 * Integration test to verify that StatusPublisher correctly adds model and agent tags
 * This test creates a real project structure and tests the actual StatusPublisher logic
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { StatusPublisher } from "./tenex/src/commands/run/StatusPublisher";

// Mock getNDK to avoid actual Nostr connections
const mockEvents: any[] = [];

// Override the NDK import
const mockNDK = {
    // Mock NDK instance
};

const mockGetNDK = () => mockNDK;

// Override NDKEvent to capture what would be published
class MockNDKEvent {
    kind = 0;
    content = "";
    tags: string[][] = [];

    tag(_projectEvent: any) {
        // Mock tag method
    }

    publish() {
        // Capture the event instead of publishing
        mockEvents.push({
            kind: this.kind,
            content: this.content,
            tags: [...this.tags], // Copy the tags
        });
    }
}

// Override global NDKEvent
(globalThis as any).NDKEvent = MockNDKEvent;

// Mock the getNDK function
const originalRequire = require;
require = (id: string) => {
    if (id === "./../../nostr/ndkClient" || id.endsWith("ndkClient")) {
        return { getNDK: mockGetNDK };
    }
    return originalRequire(id);
};

async function testStatusPublisherModelTags() {
    console.log("🧪 Testing StatusPublisher model and agent tags functionality");

    // Create temporary directory for test
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "status-publisher-test-"));
    const projectPath = path.join(tempDir, "test-project");

    try {
        // Create .tenex directory
        const tenexDir = path.join(projectPath, ".tenex");
        await fs.mkdir(tenexDir, { recursive: true });

        // Create mock llms.json with various provider types
        const llmsConfig = {
            "test-gpt-4": {
                provider: "openai",
                model: "gpt-4",
                apiKey: "test-key",
                enableCaching: false,
            },
            "test-claude": {
                provider: "anthropic",
                model: "claude-3-sonnet-20240229",
                apiKey: "test-key",
                enableCaching: true,
            },
            "test-gemma": {
                provider: "ollama",
                model: "gemma:7b",
                enableCaching: false,
            },
            "test-reference": "test-gpt-4", // String reference
            default: "test-gpt-4",
        };

        await fs.writeFile(path.join(tenexDir, "llms.json"), JSON.stringify(llmsConfig, null, 2));

        // Create mock agents.json with both string and object formats
        const defaultSigner = NDKPrivateKeySigner.generate();
        const codeSigner = NDKPrivateKeySigner.generate();

        const agentsConfig = {
            default: {
                nsec: defaultSigner.privateKey,
            },
            code: codeSigner.privateKey, // String format
            planner: {
                nsec: NDKPrivateKeySigner.generate().privateKey,
            },
        };

        await fs.writeFile(
            path.join(tenexDir, "agents.json"),
            JSON.stringify(agentsConfig, null, 2)
        );

        // Create mock project info
        const projectInfo = {
            title: "Test Status Publisher Project",
            projectPath,
            projectEvent: {
                encode: () => "test-project-ref",
            },
        };

        // Clear any previous mock events
        mockEvents.length = 0;

        // Test the StatusPublisher
        const statusPublisher = new StatusPublisher();

        // We need to test the private method by calling the public one and then stopping
        await statusPublisher.startPublishing(projectInfo as any);
        statusPublisher.stopPublishing(); // Stop the interval

        // Verify that an event was captured
        if (mockEvents.length === 0) {
            throw new Error("No status event was published");
        }

        const statusEvent = mockEvents[0];
        console.log("📡 Captured status event:", JSON.stringify(statusEvent, null, 2));

        // Parse and validate the content
        const statusContent = JSON.parse(statusEvent.content);

        // Validate basic status structure
        if (statusContent.status !== "online") {
            throw new Error(`Expected status 'online', got '${statusContent.status}'`);
        }

        if (statusContent.project !== "Test Status Publisher Project") {
            throw new Error(
                `Expected project name 'Test Status Publisher Project', got '${statusContent.project}'`
            );
        }

        // Validate LLM configs in content
        const expectedLLMConfigs = ["test-gpt-4", "test-claude", "test-gemma", "test-reference"];
        if (!statusContent.llmConfigs || !Array.isArray(statusContent.llmConfigs)) {
            throw new Error("Missing or invalid llmConfigs in status content");
        }

        for (const expectedLLM of expectedLLMConfigs) {
            if (!statusContent.llmConfigs.includes(expectedLLM)) {
                throw new Error(
                    `Missing expected LLM config '${expectedLLM}' in status. Got: ${JSON.stringify(statusContent.llmConfigs)}`
                );
            }
        }

        // Validate model tags
        const modelTags = statusEvent.tags.filter((tag: string[]) => tag[0] === "model");
        console.log("🔍 Found model tags:", modelTags);

        if (modelTags.length === 0) {
            throw new Error("No model tags found in status event");
        }

        // Check for expected model tags
        const expectedModelTags = [
            ["model", "gpt-4", "test-gpt-4"],
            ["model", "claude-3-sonnet-20240229", "test-claude"],
            ["model", "gemma:7b", "test-gemma"],
            ["model", "gpt-4", "test-reference"], // String reference should resolve
        ];

        for (const expectedTag of expectedModelTags) {
            const found = modelTags.some(
                (tag: string[]) =>
                    tag[0] === expectedTag[0] &&
                    tag[1] === expectedTag[1] &&
                    tag[2] === expectedTag[2]
            );

            if (!found) {
                throw new Error(
                    `Missing expected model tag: ${JSON.stringify(expectedTag)}. Found tags: ${JSON.stringify(modelTags)}`
                );
            }
        }

        // Validate agent tags (p tags)
        const agentTags = statusEvent.tags.filter((tag: string[]) => tag[0] === "p");
        console.log("👥 Found agent tags:", agentTags);

        if (agentTags.length !== 3) {
            throw new Error(`Expected 3 agent tags, got ${agentTags.length}`);
        }

        // Verify agent names are included
        const agentNames = agentTags.map((tag: string[]) => tag[2]);
        const expectedAgentNames = ["default", "code", "planner"];

        for (const expectedName of expectedAgentNames) {
            if (!agentNames.includes(expectedName)) {
                throw new Error(
                    `Missing expected agent name '${expectedName}' in tags. Got: ${JSON.stringify(agentNames)}`
                );
            }
        }

        // Verify pubkeys are valid
        for (const agentTag of agentTags) {
            const pubkey = agentTag[1];
            if (!pubkey || pubkey.length !== 64) {
                throw new Error(`Invalid pubkey in agent tag: ${JSON.stringify(agentTag)}`);
            }
        }

        console.log("✅ All validations passed!");

        console.log("\n📊 Test Results Summary:");
        console.log("   ✅ Status event published with correct structure");
        console.log(
            `   ✅ LLM configs included in content: ${statusContent.llmConfigs.length} configs`
        );
        console.log(`   ✅ Model tags added: ${modelTags.length} tags`);
        console.log(`   ✅ Agent tags added: ${agentTags.length} agents`);
        console.log("   ✅ String-based agent configs handled correctly");
        console.log("   ✅ LLM reference configs resolved correctly");

        console.log("\n🎉 StatusPublisher model and agent tags test completed successfully!");
    } finally {
        // Clean up
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

// Run the test
if (import.meta.main) {
    testStatusPublisherModelTags()
        .then(() => {
            console.log("\n✨ Test completed successfully!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n❌ Test failed:", error);
            process.exit(1);
        });
}
