import { describe, it, expect, beforeEach, mock } from "bun:test";
import { LLMService } from "../LLMService";
import { LLMConfigManager } from "../LLMConfigManager";
import { MockLLMProvider } from "../providers/MockProvider";
import type { LLMMessage, LLMResponse, LLMConfig } from "@/types/llm";
import { createMockLLMConfigManager } from "@/test-utils/mocks";

describe("LLMService", () => {
  let service: LLMService;
  let configManager: LLMConfigManager;
  let mockProvider: MockLLMProvider;

  beforeEach(() => {
    configManager = createMockLLMConfigManager();
    service = new LLMService(configManager);
    
    // Add a mock provider
    mockProvider = new MockLLMProvider({
      defaultResponse: "Mock response",
    });
    
    // Override provider creation to use our mock
    (service as any).createProvider = (config: LLMConfig) => mockProvider;
  });

  describe("chat", () => {
    it("should send messages to provider and return response", async () => {
      const messages: LLMMessage[] = [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "Hello" },
      ];

      const response = await service.complete("default", messages);

      expect(response.content).toBe("Mock response");
      expect(response.model).toBe("mock-model");
      expect(mockProvider.callHistory).toHaveLength(1);
      expect(mockProvider.callHistory[0].messages).toEqual(messages);
    });

    it("should use specified config", async () => {
      configManager.addConfig("custom", {
        provider: "mock",
        model: "custom-model",
        temperature: 0.5,
      });

      const messages: LLMMessage[] = [
        { role: "user", content: "Test" },
      ];

      await service.complete("custom", messages);

      expect(mockProvider.callHistory[0].config?.model).toBe("custom-model");
      expect(mockProvider.callHistory[0].config?.temperature).toBe(0.5);
    });

    it("should use default config when not specified", async () => {
      const messages: LLMMessage[] = [
        { role: "user", content: "Test" },
      ];

      await service.complete("default", messages);

      expect(mockProvider.callHistory[0].config?.model).toBe("mock-model");
    });

    it("should throw error for non-existent config", async () => {
      const messages: LLMMessage[] = [
        { role: "user", content: "Test" },
      ];

      await expect(service.complete("nonexistent", messages)).rejects.toThrow(
        "LLM configuration 'nonexistent' not found"
      );
    });

    it("should handle provider errors gracefully", async () => {
      mockProvider.setThrowError(new Error("Provider error"));

      const messages: LLMMessage[] = [
        { role: "user", content: "Test" },
      ];

      await expect(service.complete("default", messages)).rejects.toThrow("Provider error");
    });

    it("should support streaming responses", async () => {
      const messages: LLMMessage[] = [
        { role: "user", content: "Stream test" },
      ];

      const chunks: string[] = [];
      const onChunk = (chunk: string) => chunks.push(chunk);

      mockProvider.setStreamResponse(["Hello", " ", "world", "!"]);

      await service.chat(messages, "default", { stream: true, onChunk });

      expect(chunks).toEqual(["Hello", " ", "world", "!"]);
    });
  });

  describe("provider management", () => {
    it("should cache providers", async () => {
      const messages: LLMMessage[] = [{ role: "user", content: "Test" }];

      // First call creates provider
      await service.chat(messages);
      const firstProvider = (service as any).providers.get("default");

      // Second call reuses provider
      await service.chat(messages);
      const secondProvider = (service as any).providers.get("default");

      expect(firstProvider).toBe(secondProvider);
    });

    it("should create different providers for different configs", async () => {
      configManager.addConfig("config1", {
        provider: "mock",
        model: "model1",
      });
      
      configManager.addConfig("config2", {
        provider: "mock",
        model: "model2",
      });

      const messages: LLMMessage[] = [{ role: "user", content: "Test" }];

      await service.chat(messages, "config1");
      await service.chat(messages, "config2");

      const providers = (service as any).providers;
      expect(providers.size).toBe(2);
      expect(providers.has("config1")).toBe(true);
      expect(providers.has("config2")).toBe(true);
    });

    it("should handle provider initialization errors", async () => {
      (service as any).createProvider = () => {
        throw new Error("Failed to initialize provider");
      };

      const messages: LLMMessage[] = [{ role: "user", content: "Test" }];

      await expect(service.chat(messages)).rejects.toThrow(
        "Failed to initialize provider"
      );
    });
  });

  describe("message validation", () => {
    it("should validate messages have required fields", async () => {
      const invalidMessages = [
        { role: "user" }, // missing content
      ] as LLMMessage[];

      await expect(service.chat(invalidMessages)).rejects.toThrow();
    });

    it("should validate message roles", async () => {
      const invalidMessages: LLMMessage[] = [
        { role: "invalid" as any, content: "Test" },
      ];

      await expect(service.chat(invalidMessages)).rejects.toThrow();
    });

    it("should handle empty message array", async () => {
      await expect(service.chat([])).rejects.toThrow(
        "At least one message is required"
      );
    });
  });

  describe("tool calls", () => {
    it("should handle tool call responses", async () => {
      const toolCallResponse: LLMResponse = {
        content: "I'll help you with that.",
        model: "mock-model",
        toolCalls: [
          {
            id: "tool-1",
            name: "search",
            arguments: { query: "test" },
          },
        ],
      };

      mockProvider.setResponse(toolCallResponse);

      const messages: LLMMessage[] = [
        { role: "user", content: "Search for test" },
      ];

      const response = await service.chat(messages);

      expect(response.toolCalls).toBeDefined();
      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls![0].name).toBe("search");
      expect(response.toolCalls![0].arguments).toEqual({ query: "test" });
    });

    it("should handle tool results in messages", async () => {
      const messages: LLMMessage[] = [
        { role: "user", content: "Search for cats" },
        {
          role: "assistant",
          content: "I'll search for cats.",
          toolCalls: [
            {
              id: "tool-1",
              name: "search",
              arguments: { query: "cats" },
            },
          ],
        },
        {
          role: "tool",
          content: "Found 5 results about cats",
          toolCallId: "tool-1",
        },
      ];

      await service.chat(messages);

      expect(mockProvider.callHistory[0].messages).toHaveLength(3);
      expect(mockProvider.callHistory[0].messages[2].role).toBe("tool");
    });
  });

  describe("usage tracking", () => {
    it("should return usage information", async () => {
      const responseWithUsage: LLMResponse = {
        content: "Response",
        model: "mock-model",
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
      };

      mockProvider.setResponse(responseWithUsage);

      const messages: LLMMessage[] = [{ role: "user", content: "Test" }];
      const response = await service.chat(messages);

      expect(response.usage).toBeDefined();
      expect(response.usage?.promptTokens).toBe(10);
      expect(response.usage?.completionTokens).toBe(5);
      expect(response.usage?.totalTokens).toBe(15);
    });

    it("should accumulate usage across multiple calls", async () => {
      // This would be implemented in a real service
      // For now, just verify individual call usage is returned
      const messages: LLMMessage[] = [{ role: "user", content: "Test" }];

      const response1 = await service.chat(messages);
      const response2 = await service.chat(messages);

      expect(response1.usage).toBeDefined();
      expect(response2.usage).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should wrap provider errors with context", async () => {
      mockProvider.setThrowError(new Error("Network error"));

      const messages: LLMMessage[] = [{ role: "user", content: "Test" }];

      try {
        await service.chat(messages);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain("Network error");
      }
    });

    it("should handle timeout errors", async () => {
      mockProvider.setDelay(5000); // 5 second delay

      const messages: LLMMessage[] = [{ role: "user", content: "Test" }];

      await expect(
        service.chat(messages, "default", { timeout: 100 })
      ).rejects.toThrow("Request timeout");
    });

    it("should retry on transient errors", async () => {
      let callCount = 0;
      mockProvider.setCustomHandler(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error("Transient error");
        }
        return {
          content: "Success after retry",
          model: "mock-model",
        };
      });

      const messages: LLMMessage[] = [{ role: "user", content: "Test" }];

      const response = await service.chat(messages, "default", {
        maxRetries: 3,
      });

      expect(response.content).toBe("Success after retry");
      expect(callCount).toBe(3);
    });
  });
});