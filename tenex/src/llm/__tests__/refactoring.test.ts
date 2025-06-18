import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { clearLLMProviderCache, createLLMProvider } from "../LLMFactory";
import { CacheManager, ResponseCache } from "../cache/ResponseCache";
import { MessageFormatterFactory } from "../formatters/MessageFormatter";
import { ProviderRegistry, SimpleProviderFactory } from "../registry/ProviderRegistry";
import { MockLLMProvider, MockProviderFactory, type MockResponse } from "../testing/MockProvider";
import type { LLMConfig, LLMMessage } from "../types";
import { ConfigValidator } from "../utils/ConfigValidator";
import { LLMLogger } from "../utils/LLMLogger";
import { ToolCallParser } from "../utils/ToolCallParser";

describe("LLM Refactoring Phase 4", () => {
    beforeEach(() => {
        clearLLMProviderCache();
        CacheManager.clearAll();
    });

    afterEach(() => {
        clearLLMProviderCache();
        CacheManager.clearAll();
    });

    describe("MockProvider", () => {
        test("should handle simple responses", async () => {
            const provider = MockProviderFactory.createSimpleProvider([
                "Hello world",
                "How can I help you?",
            ]);

            const config: LLMConfig = {
                provider: "mock",
                model: "test-model",
                apiKey: "test-key",
            };

            const messages: LLMMessage[] = [{ role: "user", content: "Hi" }];

            const response1 = await provider.generateResponse(messages, config);
            expect(response1.content).toBe("Hello world");

            const response2 = await provider.generateResponse(messages, config);
            expect(response2.content).toBe("How can I help you?");

            const history = provider.getRequestHistory();
            expect(history).toHaveLength(2);
            expect(history[0].messages).toEqual(messages);
        });

        test("should handle tool calls", async () => {
            const provider = MockProviderFactory.createProviderWithToolCalls([
                {
                    content: "I'll help you with that task.",
                    toolCalls: [
                        {
                            name: "get_weather",
                            arguments: { location: "New York" },
                        },
                    ],
                },
            ]);

            const config: LLMConfig = {
                provider: "anthropic",
                model: "claude-3-opus",
                apiKey: "test-key",
            };

            const response = await provider.generateResponse([], config);
            expect(response.content).toContain("I'll help you with that task.");
            expect(response.content).toContain("get_weather");
        });

        test("should simulate failures", async () => {
            const provider = MockProviderFactory.createFailingProvider("Rate limit exceeded");

            const config: LLMConfig = {
                provider: "mock",
                model: "test-model",
                apiKey: "test-key",
            };

            await expect(provider.generateResponse([], config)).rejects.toThrow();
        });

        test("should simulate network delays", async () => {
            const provider = MockProviderFactory.createSlowProvider(100);

            const config: LLMConfig = {
                provider: "mock",
                model: "test-model",
                apiKey: "test-key",
            };

            const start = Date.now();
            await provider.generateResponse([], config);
            const duration = Date.now() - start;

            expect(duration).toBeGreaterThanOrEqual(100);
        });
    });

    describe("ToolCallParser", () => {
        test("should parse Anthropic tool calls", () => {
            const toolCall = {
                type: "tool_use",
                id: "tool_123",
                name: "calculator",
                input: { expression: "2 + 2" },
            };

            const parsed = ToolCallParser.parseAnthropicToolCall(toolCall);
            expect(parsed).toEqual({
                name: "calculator",
                arguments: { expression: "2 + 2" },
                id: "tool_123",
            });
        });

        test("should parse OpenAI tool calls", () => {
            const toolCall = {
                id: "call_123",
                function: {
                    name: "weather",
                    arguments: JSON.stringify({ location: "SF" }),
                },
            };

            const parsed = ToolCallParser.parseOpenAIToolCall(toolCall);
            expect(parsed).toEqual({
                name: "weather",
                arguments: { location: "SF" },
                id: "call_123",
            });
        });

        test("should handle malformed tool calls", () => {
            const badToolCall = { invalid: "data" };

            const parsed = ToolCallParser.parseAnthropicToolCall(badToolCall);
            expect(parsed).toBeNull();
        });

        test("should extract tool calls by provider", () => {
            const anthropicResponse = {
                content: [
                    { type: "text", text: "Here's the result:" },
                    {
                        type: "tool_use",
                        id: "tool_1",
                        name: "calculator",
                        input: { x: 5 },
                    },
                ],
            };

            const toolCalls = ToolCallParser.extractToolCallsByProvider(
                anthropicResponse,
                "anthropic"
            );

            expect(toolCalls).toHaveLength(1);
            expect(toolCalls[0].name).toBe("calculator");
        });
    });

    describe("ConfigValidator", () => {
        test("should validate required fields", () => {
            const validConfig: LLMConfig = {
                provider: "anthropic",
                model: "claude-3-opus",
                apiKey: "test-key",
            };

            expect(() => ConfigValidator.validate(validConfig)).not.toThrow();
        });

        test("should reject missing API key", () => {
            const invalidConfig: LLMConfig = {
                provider: "anthropic",
                model: "claude-3-opus",
                // missing apiKey
            } as LLMConfig;

            expect(() => ConfigValidator.validate(invalidConfig)).toThrow("API key is required");
        });

        test("should validate temperature range", () => {
            const invalidConfig: LLMConfig = {
                provider: "anthropic",
                model: "claude-3-opus",
                apiKey: "test-key",
                temperature: 3.0, // invalid range
            };

            expect(() => ConfigValidator.validate(invalidConfig)).toThrow(
                "Temperature must be between 0 and 2"
            );
        });

        test("should check provider support", () => {
            expect(ConfigValidator.isProviderSupported("anthropic")).toBe(true);
            expect(ConfigValidator.isProviderSupported("unknown")).toBe(false);
        });
    });

    describe("ResponseCache", () => {
        test("should cache and retrieve responses", async () => {
            const cache = new ResponseCache({
                enabled: true,
                ttl: 60000,
                maxSize: 10,
            });

            const messages: LLMMessage[] = [{ role: "user", content: "test" }];
            const config: LLMConfig = {
                provider: "anthropic",
                model: "claude-3-opus",
                apiKey: "test-key",
            };

            let callCount = 0;
            const generator = async () => {
                callCount++;
                return { content: "response", model: "test" };
            };

            // First call should hit the generator
            const response1 = await cache.get(messages, config, generator);
            expect(response1.content).toBe("response");
            expect(callCount).toBe(1);

            // Second call should use cache
            const response2 = await cache.get(messages, config, generator);
            expect(response2.content).toBe("response");
            expect(callCount).toBe(1); // No additional call

            const stats = cache.getStats();
            expect(stats.hits).toBe(1);
            expect(stats.misses).toBe(1);
            expect(stats.hitRate).toBe(0.5);
        });

        test("should respect TTL", async () => {
            const cache = new ResponseCache({
                enabled: true,
                ttl: 50, // 50ms
                maxSize: 10,
            });

            const messages: LLMMessage[] = [{ role: "user", content: "test" }];
            const config: LLMConfig = {
                provider: "anthropic",
                model: "claude-3-opus",
                apiKey: "test-key",
            };

            let callCount = 0;
            const generator = async () => {
                callCount++;
                return { content: `response ${callCount}`, model: "test" };
            };

            // First call
            const response1 = await cache.get(messages, config, generator);
            expect(response1.content).toBe("response 1");

            // Wait for TTL to expire
            await new Promise((resolve) => setTimeout(resolve, 60));

            // Second call should generate new response
            const response2 = await cache.get(messages, config, generator);
            expect(response2.content).toBe("response 2");
            expect(callCount).toBe(2);
        });
    });

    describe("ProviderRegistry", () => {
        test("should register and create providers", () => {
            const testRegistry = Object.create(ProviderRegistry);

            // Register a mock provider
            testRegistry.register(
                "test-provider",
                new SimpleProviderFactory(MockLLMProvider, undefined, 1),
                {
                    description: "Test provider",
                    features: { tools: true, streaming: false, caching: false, multimodal: false },
                }
            );

            const config: LLMConfig = {
                provider: "test-provider",
                model: "test-model",
                apiKey: "test-key",
            };

            const provider = testRegistry.create(config);
            expect(provider).toBeInstanceOf(MockLLMProvider);
        });

        test("should find providers by features", () => {
            const providers = ProviderRegistry.getProvidersByFeature("tools");
            expect(providers.length).toBeGreaterThan(0);
            expect(providers).toContain("anthropic");
        });

        test("should validate provider configurations", () => {
            const config: LLMConfig = {
                provider: "anthropic",
                model: "claude-3-opus",
                apiKey: "test-key",
            };

            const validation = ProviderRegistry.validateProvider("anthropic", config);
            expect(validation.valid).toBe(true);
            expect(validation.issues).toHaveLength(0);
        });
    });

    describe("MessageFormatterFactory", () => {
        test("should get correct formatter for provider", () => {
            const anthropicFormatter = MessageFormatterFactory.getFormatter("anthropic");
            expect(anthropicFormatter).toBeDefined();

            const openaiFormatter = MessageFormatterFactory.getFormatter("openai");
            expect(openaiFormatter).toBeDefined();
        });

        test("should format messages correctly", () => {
            const formatter = MessageFormatterFactory.getFormatter("anthropic");

            const messages: LLMMessage[] = [
                { role: "system", content: "You are helpful" },
                { role: "user", content: "Hello" },
            ];

            const config: LLMConfig = {
                provider: "anthropic",
                model: "claude-3-opus",
                apiKey: "test-key",
            };

            const formatted = formatter.formatMessages(messages, config);

            expect(formatted.system).toBe("You are helpful");
            expect(formatted.messages).toHaveLength(1);
            expect(formatted.messages[0].content).toBe("Hello");
        });

        test("should throw for unknown provider", () => {
            expect(() => MessageFormatterFactory.getFormatter("unknown")).toThrow();
        });
    });

    describe("LLMLogger", () => {
        test("should create logger with provider name", () => {
            const logger = new LLMLogger("TestProvider");
            expect(logger).toBeDefined();
        });

        test("should set verbose mode", () => {
            LLMLogger.setVerboseMode(true);
            expect(LLMLogger.isVerboseMode()).toBe(true);

            LLMLogger.setVerboseMode(false);
            expect(LLMLogger.isVerboseMode()).toBe(false);
        });
    });

    describe("Integration Tests", () => {
        test("should create provider through factory with new registry", () => {
            const config: LLMConfig = {
                provider: "anthropic",
                model: "claude-3-opus",
                apiKey: "test-key",
                enableCaching: true,
            };

            const provider = createLLMProvider(config);
            expect(provider).toBeDefined();
        });

        test("should handle caching configuration automatically", () => {
            const configWithCaching: LLMConfig = {
                provider: "anthropic",
                model: "claude-3-opus",
                apiKey: "test-key",
                enableCaching: true,
            };

            const configWithoutCaching: LLMConfig = {
                provider: "anthropic",
                model: "claude-3-opus",
                apiKey: "test-key",
                enableCaching: false,
            };

            const providerWithCache = createLLMProvider(configWithCaching);
            const providerWithoutCache = createLLMProvider(configWithoutCaching);

            expect(providerWithCache).toBeDefined();
            expect(providerWithoutCache).toBeDefined();
            // They should be different instances due to different caching settings
            expect(providerWithCache).not.toBe(providerWithoutCache);
        });

        test("should maintain backward compatibility", () => {
            // Test that old-style usage still works
            const config: LLMConfig = {
                provider: "openai",
                model: "gpt-4",
                apiKey: "test-key",
            };

            expect(() => createLLMProvider(config)).not.toThrow();
        });
    });
});

describe("Performance Tests", () => {
    test("should handle multiple concurrent requests", async () => {
        const provider = MockProviderFactory.createSimpleProvider([
            "Response 1",
            "Response 2",
            "Response 3",
            "Response 4",
            "Response 5",
        ]);

        const config: LLMConfig = {
            provider: "mock",
            model: "test-model",
            apiKey: "test-key",
        };

        const messages: LLMMessage[] = [{ role: "user", content: "test" }];

        const promises = Array(5)
            .fill(0)
            .map(() => provider.generateResponse(messages, config));

        const responses = await Promise.all(promises);
        expect(responses).toHaveLength(5);
        expect(responses.every((r) => r.content.length > 0)).toBe(true);
    });

    test("should clear caches efficiently", () => {
        const start = Date.now();

        // Create some cached providers
        for (let i = 0; i < 10; i++) {
            createLLMProvider({
                provider: "anthropic",
                model: `model-${i}`,
                apiKey: "test-key",
            });
        }

        clearLLMProviderCache();
        const duration = Date.now() - start;

        expect(duration).toBeLessThan(100); // Should be very fast
    });
});
