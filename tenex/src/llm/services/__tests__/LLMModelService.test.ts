import { describe, it, expect, beforeEach, vi } from "vitest";
import { llmModelService } from "../LLMModelService";
import { loadModels } from "multi-llm-ts";

// Mock the multi-llm-ts module
vi.mock("multi-llm-ts", () => ({
  loadModels: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

describe("LLMModelService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    llmModelService.clearCache();
  });

  describe("fetchModels", () => {
    it("should fetch models from API successfully", async () => {
      const mockModels = {
        chat: ["gpt-4", "gpt-3.5-turbo"],
        image: [],
        embedding: [],
      };
      vi.mocked(loadModels).mockResolvedValue(mockModels);

      const models = await llmModelService.fetchModels("openai", "test-key");

      expect(models).toEqual(["gpt-4", "gpt-3.5-turbo"]);
      expect(loadModels).toHaveBeenCalledWith("openai", { apiKey: "test-key" });
    });

    it("should return fallback models when API fails", async () => {
      vi.mocked(loadModels).mockRejectedValue(new Error("API Error"));

      const models = await llmModelService.fetchModels("openai");

      expect(models).toEqual(["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"]);
    });

    it("should use cache for subsequent calls", async () => {
      const mockModels = {
        chat: ["gpt-4"],
        image: [],
        embedding: [],
      };
      vi.mocked(loadModels).mockResolvedValue(mockModels);

      // First call
      await llmModelService.fetchModels("openai");
      // Second call
      await llmModelService.fetchModels("openai");

      expect(loadModels).toHaveBeenCalledTimes(1);
    });

    it("should handle model objects with id property", async () => {
      const mockModels = {
        chat: [
          { id: "model-1", name: "Model One" },
          { id: "model-2", name: "Model Two" },
        ],
        image: [],
        embedding: [],
      };
      vi.mocked(loadModels).mockResolvedValue(mockModels);

      const models = await llmModelService.fetchModels("anthropic");

      expect(models).toEqual(["model-1", "model-2"]);
    });
  });

  describe("fetchOpenRouterModelsWithMetadata", () => {
    it("should fetch OpenRouter models with pricing metadata", async () => {
      const mockResponse = {
        data: [
          {
            id: "openai/gpt-4",
            name: "GPT-4",
            pricing: {
              prompt: "0.03",
              completion: "0.06",
              input_cache_read: "0.015",
              input_cache_write: "0.075",
            },
            input_modalities: ["text"],
            output_modalities: ["text"],
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const models = await llmModelService.fetchOpenRouterModelsWithMetadata();

      expect(models).toHaveLength(1);
      expect(models[0]).toEqual({
        id: "openai/gpt-4",
        name: "GPT-4",
        supportsCaching: true,
        promptPrice: 30000,
        completionPrice: 60000,
        cacheReadPrice: 15000,
        cacheWritePrice: 75000,
      });
    });

    it("should return fallback models when API fails", async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

      const models = await llmModelService.fetchOpenRouterModelsWithMetadata();

      expect(models).toHaveLength(2);
      expect(models[0].id).toBe("anthropic/claude-3.5-sonnet");
    });
  });

  describe("getProviderId", () => {
    it("should map provider names correctly", () => {
      expect(llmModelService.getProviderId("mistral")).toBe("mistralai");
      expect(llmModelService.getProviderId("openai")).toBe("openai");
      expect(llmModelService.getProviderId("unknown")).toBe("unknown");
    });
  });

  describe("isUsingFallback", () => {
    it("should detect when using fallback models", () => {
      const fallbackModels = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"];
      expect(llmModelService.isUsingFallback("openai", fallbackModels)).toBe(true);
      
      const customModels = ["gpt-4", "custom-model"];
      expect(llmModelService.isUsingFallback("openai", customModels)).toBe(false);
    });
  });
});