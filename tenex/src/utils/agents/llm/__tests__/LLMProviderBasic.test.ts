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

        // Check provider names (protected properties)
        expect((anthropic as any).providerName).toBe("Anthropic");
        expect((openai as any).providerName).toBe("OpenAI");
        expect((openrouter as any).providerName).toBe("OpenRouter");

        // Check default models
        expect((anthropic as any).defaultModel).toBe("claude-3-opus-20240229");
        expect((openai as any).defaultModel).toBe("gpt-4");
        expect((openrouter as any).defaultModel).toBe("");

        // Check default base URLs
        expect((anthropic as any).defaultBaseURL).toBe("https://api.anthropic.com/v1");
        expect((openai as any).defaultBaseURL).toBe("https://api.openai.com/v1");
        expect((openrouter as any).defaultBaseURL).toBe("https://openrouter.ai/api/v1");
    });

    it("should validate API keys correctly", async () => {
        const providers = [new AnthropicProvider(), new OpenAIProvider(), new OpenRouterProvider()];

        const invalidConfig = { apiKey: undefined };

        for (const provider of providers) {
            const providerName = (provider as any).providerName;
            await expect(provider.generateResponse([], invalidConfig as any)).rejects.toThrow(
                `${providerName} API key is required`
            );
        }
    });

    it("should have shared base functionality", () => {
        const providers = [new AnthropicProvider(), new OpenAIProvider(), new OpenRouterProvider()];

        // All providers should have these base methods
        for (const provider of providers) {
            expect(typeof (provider as any).validateConfig).toBe("function");
            expect(typeof (provider as any).logRequest).toBe("function");
            expect(typeof (provider as any).logResponse).toBe("function");
            expect(typeof (provider as any).formatToolCallsAsText).toBe("function");
            expect(typeof (provider as any).buildRequestBody).toBe("function");
            expect(typeof (provider as any).makeRequest).toBe("function");
            expect(typeof (provider as any).parseResponse).toBe("function");
            expect(typeof (provider as any).extractUsage).toBe("function");
            expect(typeof (provider as any).extractToolCallData).toBe("function");
        }
    });

    it("should require model for OpenRouter", async () => {
        const openrouter = new OpenRouterProvider();
        const configWithoutModel = { apiKey: "test-key", model: undefined };

        await expect(openrouter.generateResponse([], configWithoutModel as any)).rejects.toThrow(
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
