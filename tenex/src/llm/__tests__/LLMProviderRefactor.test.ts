import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LLMConfig } from "../../types";
import { AnthropicProvider } from "../AnthropicProvider";
import { OpenAIProvider } from "../OpenAIProvider";
import { OpenRouterProvider } from "../OpenRouterProvider";
import type { LLMMessage } from "../types";

describe("LLM Provider Refactoring", () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = mockFetch;
    });

    const sampleMessages: LLMMessage[] = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello, how are you?" },
    ];

    const sampleConfig: LLMConfig = {
        provider: "test",
        model: "test-model",
        apiKey: "test-api-key",
        temperature: 0.7,
        maxTokens: 1000,
    };

    describe("AnthropicProvider", () => {
        it("should extend BaseLLMProvider and maintain functionality", async () => {
            const provider = new AnthropicProvider();

            // Mock successful Anthropic response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: "msg_123",
                    type: "message",
                    role: "assistant",
                    content: [{ type: "text", text: "Hello! I'm doing well, thank you." }],
                    model: "claude-3-opus-20240229",
                    stop_reason: "end_turn",
                    usage: {
                        input_tokens: 10,
                        output_tokens: 15,
                        cache_creation_input_tokens: 0,
                        cache_read_input_tokens: 0,
                    },
                }),
            });

            const response = await provider.generateResponse(sampleMessages, sampleConfig);

            expect(response.content).toBe("Hello! I'm doing well, thank you.");
            expect(response.model).toBe("claude-3-opus-20240229");
            expect(response.usage?.prompt_tokens).toBe(10);
            expect(response.usage?.completion_tokens).toBe(15);

            // Verify correct Anthropic API format
            expect(mockFetch).toHaveBeenCalledWith(
                "https://api.anthropic.com/v1/messages",
                expect.objectContaining({
                    method: "POST",
                    headers: expect.objectContaining({
                        "x-api-key": "test-api-key",
                        "anthropic-version": "2023-06-01",
                    }),
                })
            );
        });

        it("should handle tool calls correctly", async () => {
            const provider = new AnthropicProvider();

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: "msg_456",
                    type: "message",
                    role: "assistant",
                    content: [
                        { type: "text", text: "I'll help you with that." },
                        {
                            type: "tool_use",
                            id: "tool_123",
                            name: "search",
                            input: { query: "test" },
                        },
                    ],
                    model: "claude-3-opus-20240229",
                    stop_reason: "tool_use",
                    usage: {
                        input_tokens: 10,
                        output_tokens: 15,
                        cache_creation_input_tokens: 0,
                        cache_read_input_tokens: 0,
                    },
                }),
            });

            const response = await provider.generateResponse(sampleMessages, sampleConfig);

            expect(response.content).toContain("I'll help you with that.");
            expect(response.content).toContain('"tool": "search"');
            expect(response.content).toContain('"arguments": {"query":"test"}');
        });
    });

    describe("OpenAIProvider", () => {
        it("should extend BaseLLMProvider and maintain functionality", async () => {
            const provider = new OpenAIProvider();

            // Mock successful OpenAI response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: "Hello! I'm doing great." } }],
                    model: "gpt-4",
                    usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
                }),
            });

            const response = await provider.generateResponse(sampleMessages, sampleConfig);

            expect(response.content).toBe("Hello! I'm doing great.");
            expect(response.model).toBe("gpt-4");
            expect(response.usage?.prompt_tokens).toBe(10);
            expect(response.usage?.completion_tokens).toBe(15);
            expect(response.usage?.total_tokens).toBe(25);

            // Verify correct OpenAI API format
            expect(mockFetch).toHaveBeenCalledWith(
                "https://api.openai.com/v1/chat/completions",
                expect.objectContaining({
                    method: "POST",
                    headers: expect.objectContaining({
                        Authorization: "Bearer test-api-key",
                    }),
                })
            );
        });

        it("should handle tool calls correctly", async () => {
            const provider = new OpenAIProvider();

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [
                        {
                            message: {
                                content: "I'll search for that.",
                                tool_calls: [
                                    {
                                        function: {
                                            name: "search",
                                            arguments: '{"query":"test"}',
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                    model: "gpt-4",
                    usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
                }),
            });

            const response = await provider.generateResponse(sampleMessages, sampleConfig);

            expect(response.content).toContain("I'll search for that.");
            expect(response.content).toContain('"tool": "search"');
            expect(response.content).toContain('"arguments": {"query":"test"}');
        });
    });

    describe("OpenRouterProvider", () => {
        it("should extend BaseLLMProvider and maintain functionality", async () => {
            const provider = new OpenRouterProvider();

            // Mock successful OpenRouter response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: "Hello! I'm doing excellent." } }],
                    model: "openrouter/test-model",
                    usage: {
                        prompt_tokens: 10,
                        completion_tokens: 15,
                        total_tokens: 25,
                        cost: 0.001,
                    },
                }),
            });

            const response = await provider.generateResponse(sampleMessages, sampleConfig);

            expect(response.content).toBe("Hello! I'm doing excellent.");
            expect(response.model).toBe("openrouter/test-model");
            expect(response.usage?.prompt_tokens).toBe(10);
            expect(response.usage?.completion_tokens).toBe(15);
            expect(response.usage?.cost).toBe(0.001);

            // Verify correct OpenRouter API format
            expect(mockFetch).toHaveBeenCalledWith(
                "https://openrouter.ai/api/v1/chat/completions",
                expect.objectContaining({
                    method: "POST",
                    headers: expect.objectContaining({
                        Authorization: "Bearer test-api-key",
                        "HTTP-Referer": "tenex-cli",
                        "X-Title": "TENEX CLI Agent",
                    }),
                })
            );
        });

        it("should handle caching configuration correctly", async () => {
            const provider = new OpenRouterProvider();
            const configWithCaching = { ...sampleConfig, enableCaching: true };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: "Response with caching." } }],
                    model: "openrouter/test-model",
                    usage: {
                        prompt_tokens: 10,
                        completion_tokens: 15,
                        total_tokens: 25,
                        cached_tokens: 5,
                    },
                }),
            });

            const response = await provider.generateResponse(sampleMessages, configWithCaching);

            expect(response.content).toBe("Response with caching.");
            expect(response.usage?.cache_read_input_tokens).toBe(5);
        });

        it("should require model to be specified", async () => {
            const provider = new OpenRouterProvider();
            const configWithoutModel = { ...sampleConfig, model: undefined };

            await expect(
                provider.generateResponse(sampleMessages, configWithoutModel)
            ).rejects.toThrow("Model is required for OpenRouter");
        });
    });

    describe("Error Handling", () => {
        it("should handle API errors consistently across providers", async () => {
            const providers = [
                new AnthropicProvider(),
                new OpenAIProvider(),
                new OpenRouterProvider(),
            ];

            mockFetch.mockResolvedValue({
                ok: false,
                status: 401,
                text: async () => "Unauthorized",
            });

            for (const provider of providers) {
                const providerName = provider.constructor.name.replace("Provider", "");
                await expect(
                    provider.generateResponse(sampleMessages, sampleConfig)
                ).rejects.toThrow(`${providerName} API error: 401 - Unauthorized`);
            }
        });

        it("should validate API keys consistently", async () => {
            const providers = [
                new AnthropicProvider(),
                new OpenAIProvider(),
                new OpenRouterProvider(),
            ];

            const configWithoutApiKey = { ...sampleConfig, apiKey: undefined };

            for (const provider of providers) {
                const providerName = provider.constructor.name.replace("Provider", "");
                await expect(
                    provider.generateResponse(sampleMessages, configWithoutApiKey)
                ).rejects.toThrow(`${providerName} API key is required`);
            }
        });
    });

    describe("Code Consolidation Benefits", () => {
        it("should share common logging patterns", () => {
            // This test verifies that all providers now use the same base logging
            const providers = [
                new AnthropicProvider(),
                new OpenAIProvider(),
                new OpenRouterProvider(),
            ];

            // All providers should have the same error handling and logging infrastructure
            expect(providers.every((p) => typeof (p as any).logRequest === "function")).toBe(true);
            expect(providers.every((p) => typeof (p as any).logResponse === "function")).toBe(true);
            expect(providers.every((p) => typeof (p as any).validateConfig === "function")).toBe(
                true
            );
        });

        it("should share common tool call formatting", () => {
            const providers = [
                new AnthropicProvider(),
                new OpenAIProvider(),
                new OpenRouterProvider(),
            ];

            // All providers should have the same tool call formatting
            expect(
                providers.every((p) => typeof (p as any).formatToolCallsAsText === "function")
            ).toBe(true);
        });
    });
});
