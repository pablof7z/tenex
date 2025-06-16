import { describe, expect, it } from "vitest";
import { ConversationStorage } from "../../../../utils/agents/ConversationStorage";
import { createLLMProvider } from "../../../../utils/agents/llm/LLMFactory";
import type { LLMConfig } from "../../../../utils/agents/types";
import { createOrchestrationCoordinator } from "../../OrchestrationFactory";

describe("OrchestrationFactory Integration", () => {
    it("should create orchestration coordinator with OpenRouter config", async () => {
        const openRouterConfig: LLMConfig = {
            provider: "openrouter",
            model: "gpt-4",
            apiKey: "test-api-key",
            temperature: 0.7,
            maxTokens: 2000,
        };

        // Create the LLM provider as the system would
        const llmProvider = createLLMProvider(openRouterConfig);

        // Create conversation storage
        const tempPath = `/tmp/test-project-${Date.now()}`;
        const conversationStorage = new ConversationStorage(tempPath);

        // Create orchestration coordinator with full config
        const coordinator = createOrchestrationCoordinator({
            llmProvider,
            llmConfig: openRouterConfig, // Pass the full config
            conversationStorage,
            config: {
                orchestrator: {
                    llmConfig: "default",
                },
            },
        });

        // Verify coordinator was created successfully
        expect(coordinator).toBeDefined();
        expect(coordinator.handleUserEvent).toBeDefined();
        expect(coordinator.getTeamForConversation).toBeDefined();
    });

    it("should create orchestration coordinator with Anthropic config", async () => {
        const anthropicConfig: LLMConfig = {
            provider: "anthropic",
            model: "claude-3-opus-20240229",
            apiKey: "test-api-key",
            enableCaching: true,
            temperature: 0.5,
            maxTokens: 4000,
        };

        // Create the LLM provider as the system would
        const llmProvider = createLLMProvider(anthropicConfig);

        // Create conversation storage
        const tempPath = `/tmp/test-project-${Date.now()}`;
        const conversationStorage = new ConversationStorage(tempPath);

        // Create orchestration coordinator with full config
        const coordinator = createOrchestrationCoordinator({
            llmProvider,
            llmConfig: anthropicConfig, // Pass the full config
            conversationStorage,
        });

        // Verify coordinator was created successfully
        expect(coordinator).toBeDefined();
    });

    it("should work without passing llmConfig (backwards compatibility)", async () => {
        const config: LLMConfig = {
            provider: "openai",
            model: "gpt-4",
            apiKey: "test-api-key",
        };

        // Create the LLM provider
        const llmProvider = createLLMProvider(config);

        // Create conversation storage
        const tempPath = `/tmp/test-project-${Date.now()}`;
        const conversationStorage = new ConversationStorage(tempPath);

        // Create orchestration coordinator without llmConfig
        const coordinator = createOrchestrationCoordinator({
            llmProvider,
            conversationStorage,
        });

        // Should still create successfully (though it may fail when actually used without apiKey)
        expect(coordinator).toBeDefined();
    });
});
