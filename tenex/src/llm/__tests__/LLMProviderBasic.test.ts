import { describe, expect, it } from "vitest";
import { AnthropicProvider } from "../AnthropicProvider";
import { BaseLLMProvider } from "../BaseLLMProvider";
import { OpenAIProvider } from "../OpenAIProvider";
import { OpenRouterProvider } from "../OpenRouterProvider";

describe("LLM Provider Refactoring - Basic Functionality", () => {
    it("should properly instantiate all providers", () => {
        const anthropic = new AnthropicProvider();
        const openai = new OpenAIProvider();
        const openrouter = new OpenRouterProvider();

        expect(anthropic).toBeInstanceOf(BaseLLMProvider);
        expect(openai).toBeInstanceOf(BaseLLMProvider);
        expect(openrouter).toBeInstanceOf(BaseLLMProvider);
    });

    it("should have provider-specific configurations", () => {
        const anthropic = new AnthropicProvider();
        const openai = new OpenAIProvider();
        const openrouter = new OpenRouterProvider();

        // Check provider names
        expect(anthropic.provider).toBe("Anthropic");
        expect(openai.provider).toBe("OpenAI");
        expect(openrouter.provider).toBe("OpenRouter");

        // Check default models
        expect(anthropic.model).toBe("claude-3-opus-20240229");
        expect(openai.model).toBe("gpt-4");
        expect(openrouter.model).toBe("");

        // Note: Cannot test defaultBaseURL as it's protected and not exposed via getter
    });

    it("should validate API keys correctly", async () => {
        const providers = [new AnthropicProvider(), new OpenAIProvider(), new OpenRouterProvider()];

        for (const provider of providers) {
            const providerName = provider.provider;
            const invalidConfig = {
                provider: providerName.toLowerCase(),
                model: "test-model",
                // missing apiKey
            };

            await expect(provider.generateResponse([], invalidConfig as never)).rejects.toThrow(
                `${providerName} API key is required`
            );
        }
    });

    it("should have shared base functionality", () => {
        const providers = [new AnthropicProvider(), new OpenAIProvider(), new OpenRouterProvider()];

        // All providers should have these base methods (note: some were moved to utilities)
        for (const provider of providers) {
            // Note: Cannot test protected methods as they're not exposed

            // Validation was moved to ConfigValidator utility class
            // Logging was moved to LLMLogger utility class
            expect(provider.generateResponse).toBeDefined();
        }
    });

    it("should require model for OpenRouter", async () => {
        const openrouter = new OpenRouterProvider();
        const configWithoutModel = {
            provider: "openrouter",
            apiKey: "test-key",
            model: undefined,
        };

        await expect(openrouter.generateResponse([], configWithoutModel as never)).rejects.toThrow(
            "Model is required for OpenRouter"
        );
    });

    it("should consolidate duplicated code successfully", () => {
        // Test that the refactoring achieved the goal of code consolidation
        const anthropic = new AnthropicProvider();
        const openai = new OpenAIProvider();
        const openrouter = new OpenRouterProvider();

        // All providers should extend the same base class
        expect(anthropic.constructor.name).toBe("AnthropicProvider");
        expect(openai.constructor.name).toBe("OpenAIProvider");
        expect(openrouter.constructor.name).toBe("OpenRouterProvider");

        // They should all inherit from BaseLLMProvider
        expect(Object.getPrototypeOf(anthropic.constructor).name).toBe("BaseLLMProvider");
        expect(Object.getPrototypeOf(openai.constructor).name).toBe("BaseLLMProvider");
        expect(Object.getPrototypeOf(openrouter.constructor).name).toBe("BaseLLMProvider");
    });
});
