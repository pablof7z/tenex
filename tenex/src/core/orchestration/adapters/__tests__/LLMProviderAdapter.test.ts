import { describe, expect, it, vi } from "vitest";
import type { ToolEnabledProvider } from "../../../../utils/agents/llm/ToolEnabledProvider";
import type { LLMMessage, LLMResponse } from "../../../../utils/agents/llm/types";
import type { LLMConfig } from "../../../../utils/agents/types";
import { LLMProviderAdapter } from "../LLMProviderAdapter";

describe("LLMProviderAdapter", () => {
    it("should throw error when provider is undefined", () => {
        expect(() => new LLMProviderAdapter(undefined as unknown as ToolEnabledProvider)).toThrow(
            "AgentLLMProvider is required"
        );
    });

    it("should call generateResponse with proper LLMConfig including apiKey", async () => {
        const mockResponse: LLMResponse = {
            content: "Test response",
            usage: {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
            },
        };

        const mockProvider: ToolEnabledProvider = {
            generateResponse: vi.fn().mockResolvedValue(mockResponse),
            getLastRenderInChat: vi.fn(),
            clearRenderInChat: vi.fn(),
        };

        // Create adapter with base config that includes apiKey
        const baseConfig = {
            apiKey: "test-api-key",
            provider: "openai",
        };
        const adapter = new LLMProviderAdapter(mockProvider, baseConfig);

        // This should merge with base config
        const orchestrationConfig = {
            model: "gpt-4",
            temperature: 0.7,
            maxTokens: 1000,
        };

        await adapter.complete("Test prompt", orchestrationConfig);

        // Verify generateResponse was called
        expect(mockProvider.generateResponse).toHaveBeenCalled();

        // Verify generateResponse was called with merged config
        expect(mockProvider.generateResponse).toHaveBeenCalledWith(
            [{ role: "user", content: "Test prompt" }],
            {
                apiKey: "test-api-key",
                provider: "openai",
                model: "gpt-4",
                temperature: 0.7,
                maxTokens: 1000, // Note: stays as maxTokens - conversion happens in individual providers
            }
        );
    });

    it("should fail when underlying provider expects apiKey but adapter doesn't pass it", async () => {
        // This test demonstrates the current bug
        const mockProvider: ToolEnabledProvider = {
            generateResponse: vi
                .fn()
                .mockImplementation((_messages: LLMMessage[], config?: LLMConfig) => {
                    // Simulate OpenRouterProvider behavior
                    if (!config?.apiKey) {
                        throw new Error("undefined is not an object (evaluating 'config.apiKey')");
                    }
                    return Promise.resolve({ content: "Success" });
                }),
            getLastRenderInChat: vi.fn(),
            clearRenderInChat: vi.fn(),
        };

        const adapter = new LLMProviderAdapter(mockProvider);

        // The adapter receives config without apiKey from orchestration
        const orchestrationConfig = {
            model: "gpt-4",
            temperature: 0.7,
            maxTokens: 1000,
        };

        // This should fail because apiKey is missing
        await expect(adapter.complete("Test prompt", orchestrationConfig)).rejects.toThrow(
            "undefined is not an object (evaluating 'config.apiKey')"
        );
    });

    it("should handle missing config gracefully", async () => {
        const mockResponse: LLMResponse = {
            content: "Test response",
        };

        const mockProvider: ToolEnabledProvider = {
            generateResponse: vi.fn().mockResolvedValue(mockResponse),
            getLastRenderInChat: vi.fn(),
            clearRenderInChat: vi.fn(),
        };

        const adapter = new LLMProviderAdapter(mockProvider);

        // Call without config
        await adapter.complete("Test prompt");

        // Should pass empty object when no config provided
        expect(mockProvider.generateResponse).toHaveBeenCalledWith(
            [{ role: "user", content: "Test prompt" }],
            {}
        );
    });

    it("should pass base config with apiKey when provided", async () => {
        const mockResponse: LLMResponse = {
            content: "Test response",
        };

        const mockProvider: ToolEnabledProvider = {
            generateResponse: vi.fn().mockResolvedValue(mockResponse),
            getLastRenderInChat: vi.fn(),
            clearRenderInChat: vi.fn(),
        };

        const baseConfig = {
            provider: "openrouter",
            model: "gpt-4",
            apiKey: "test-api-key",
            temperature: 0.7,
        };

        const adapter = new LLMProviderAdapter(mockProvider, baseConfig);

        // Call without orchestration config overrides
        await adapter.complete("Test prompt");

        // Should pass the full base config
        expect(mockProvider.generateResponse).toHaveBeenCalledWith(
            [{ role: "user", content: "Test prompt" }],
            baseConfig
        );
    });

    it("should merge base config with orchestration overrides", async () => {
        const mockResponse: LLMResponse = {
            content: "Test response",
        };

        const mockProvider: ToolEnabledProvider = {
            generateResponse: vi.fn().mockResolvedValue(mockResponse),
            getLastRenderInChat: vi.fn(),
            clearRenderInChat: vi.fn(),
        };

        const baseConfig = {
            provider: "openrouter",
            model: "gpt-4",
            apiKey: "test-api-key",
            temperature: 0.7,
            maxTokens: 2000,
        };

        const adapter = new LLMProviderAdapter(mockProvider, baseConfig);

        // Call with orchestration config overrides
        const orchestrationConfig = {
            temperature: 0.9,
            maxTokens: 4000,
        };

        await adapter.complete("Test prompt", orchestrationConfig);

        // Should merge configs, with orchestration overrides taking precedence
        expect(mockProvider.generateResponse).toHaveBeenCalledWith(
            [{ role: "user", content: "Test prompt" }],
            {
                provider: "openrouter",
                model: "gpt-4",
                apiKey: "test-api-key",
                temperature: 0.9, // overridden
                maxTokens: 4000, // overridden but stays as maxTokens - conversion happens in individual providers
            }
        );
    });
});
