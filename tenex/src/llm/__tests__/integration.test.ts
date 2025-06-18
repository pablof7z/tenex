import { beforeEach, describe, expect, test } from "bun:test";
import {
    ConfigValidator,
    type LLMConfig,
    type LLMMessage,
    MessageFormatterFactory,
    MockLLMProvider,
    MockProviderFactory,
    ProviderRegistry,
    ResponseCache,
    SimpleProviderFactory,
    ToolCallParser,
    clearLLMProviderCache,
    createLLMProvider,
} from "../index";

describe("LLM Refactoring Integration Test", () => {
    beforeEach(() => {
        clearLLMProviderCache();
    });

    test("should export all refactored components", () => {
        // Verify all major components are exported
        expect(createLLMProvider).toBeDefined();
        expect(MockLLMProvider).toBeDefined();
        expect(MockProviderFactory).toBeDefined();
        expect(ProviderRegistry).toBeDefined();
        expect(ConfigValidator).toBeDefined();
        expect(ToolCallParser).toBeDefined();
        expect(MessageFormatterFactory).toBeDefined();
        expect(ResponseCache).toBeDefined();
    });

    test("should create providers through new registry system", () => {
        const config: LLMConfig = {
            provider: "anthropic",
            model: "claude-3-5-sonnet-20241022",
            apiKey: "test-key",
        };

        const provider = createLLMProvider(config);
        expect(provider).toBeDefined();
    });

    test("should work with mock providers", async () => {
        // Register a mock provider
        ProviderRegistry.register(
            "integration-test",
            new SimpleProviderFactory(MockLLMProvider, undefined, 1),
            {
                description: "Integration test provider",
                features: { tools: true, streaming: false, caching: false, multimodal: false },
            }
        );

        const config: LLMConfig = {
            provider: "integration-test",
            model: "test-model",
            apiKey: "test-key",
        };

        const provider = createLLMProvider(config) as MockLLMProvider;
        provider.addResponse({ content: "Integration test successful!" });

        const messages: LLMMessage[] = [{ role: "user", content: "Test message" }];

        const response = await provider.generateResponse(messages, config);
        expect(response.content).toBe("Integration test successful!");

        // Clean up
        ProviderRegistry.unregister("integration-test");
    });

    test("should validate configurations properly", () => {
        const validConfig: LLMConfig = {
            provider: "anthropic",
            model: "claude-3-5-sonnet-20241022",
            apiKey: "test-key",
        };

        expect(() => ConfigValidator.validate(validConfig)).not.toThrow();

        const invalidConfig: LLMConfig = {
            provider: "anthropic",
            model: "claude-3-5-sonnet-20241022",
            temperature: 5.0, // Invalid temperature
        } as LLMConfig;

        expect(() => ConfigValidator.validate(invalidConfig)).toThrow();
    });

    test("should format messages correctly", () => {
        const formatter = MessageFormatterFactory.getFormatter("anthropic");

        const messages: LLMMessage[] = [
            { role: "system", content: "You are helpful" },
            { role: "user", content: "Hello" },
        ];

        const config: LLMConfig = {
            provider: "anthropic",
            model: "claude-3-5-sonnet-20241022",
            apiKey: "test-key",
        };

        const formatted = formatter.formatMessages(messages, config);

        expect(formatted.system).toBe("You are helpful");
        expect(formatted.messages).toHaveLength(1);
        expect(formatted.messages[0].content).toBe("Hello");
    });

    test("should parse tool calls correctly", () => {
        const anthropicToolCall = {
            type: "tool_use",
            id: "tool_123",
            name: "calculator",
            input: { expression: "2 + 2" },
        };

        const parsed = ToolCallParser.parseAnthropicToolCall(anthropicToolCall);
        expect(parsed).toEqual({
            name: "calculator",
            arguments: { expression: "2 + 2" },
            id: "tool_123",
        });
    });

    test("should maintain backward compatibility", () => {
        // Test that all the old provider creation patterns still work
        const configs = [
            { provider: "anthropic", model: "claude-3-5-sonnet-20241022", apiKey: "test" },
            { provider: "openai", model: "gpt-4", apiKey: "test" },
            { provider: "openrouter", model: "any", apiKey: "test" },
            { provider: "ollama", model: "llama3.2", apiKey: "test" },
        ] as LLMConfig[];

        for (const config of configs) {
            expect(() => createLLMProvider(config)).not.toThrow();
        }
    });

    test("should handle caching configuration automatically", () => {
        const configWithCaching: LLMConfig = {
            provider: "anthropic",
            model: "claude-3-5-sonnet-20241022",
            apiKey: "test-key",
            enableCaching: true,
        };

        const configWithoutCaching: LLMConfig = {
            provider: "anthropic",
            model: "claude-3-5-sonnet-20241022",
            apiKey: "test-key",
            enableCaching: false,
        };

        const providerWithCache = createLLMProvider(configWithCaching);
        const providerWithoutCache = createLLMProvider(configWithoutCaching);

        expect(providerWithCache).toBeDefined();
        expect(providerWithoutCache).toBeDefined();
    });

    test("should support feature-based provider discovery", () => {
        const toolProviders = ProviderRegistry.getProvidersByFeature("tools");
        expect(toolProviders.length).toBeGreaterThan(0);
        expect(toolProviders).toContain("anthropic");
        expect(toolProviders).toContain("openai");

        const cachingProviders = ProviderRegistry.getProvidersByFeature("caching");
        expect(cachingProviders.length).toBeGreaterThan(0);
        expect(cachingProviders).toContain("anthropic-cached");
    });
});

describe("Performance and Reliability", () => {
    test("should handle concurrent provider creation efficiently", async () => {
        const start = Date.now();

        const promises = Array(20)
            .fill(0)
            .map((_, i) => {
                const config: LLMConfig = {
                    provider: "anthropic",
                    model: "claude-3-5-sonnet-20241022",
                    apiKey: `test-key-${i}`,
                };
                return Promise.resolve(createLLMProvider(config));
            });

        const providers = await Promise.all(promises);
        const duration = Date.now() - start;

        expect(providers).toHaveLength(20);
        expect(duration).toBeLessThan(100); // Should be very fast due to caching
    });

    test("should properly clean up resources", () => {
        // Create multiple providers
        for (let i = 0; i < 10; i++) {
            createLLMProvider({
                provider: "anthropic",
                model: `model-${i}`,
                apiKey: "test-key",
            });
        }

        // Clear caches
        clearLLMProviderCache();

        // Should not throw and should be fast
        expect(() => clearLLMProviderCache()).not.toThrow();
    });
});
