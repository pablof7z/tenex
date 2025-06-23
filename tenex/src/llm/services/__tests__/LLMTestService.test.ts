import { describe, it, expect, beforeEach, vi } from "vitest";
import { llmTestService } from "../LLMTestService";
import { MultiLLMService } from "../../MultiLLMService";
import type { LLMConfig } from "../../types";
import type { TenexLLMs } from "@/services/config/types";

// Mock the MultiLLMService
vi.mock("../../MultiLLMService", () => ({
  MultiLLMService: vi.fn().mockImplementation(() => ({
    complete: vi.fn(),
  })),
}));

// Mock logger
vi.mock("@/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("LLMTestService", () => {
  const mockConfig: LLMConfig = {
    provider: "openai",
    model: "gpt-4",
  };

  const mockLLMsConfig: TenexLLMs = {
    configurations: {
      test: mockConfig,
    },
    defaults: {},
    credentials: {
      openai: {
        apiKey: "test-key",
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("testConfiguration", () => {
    it("should return true for successful test", async () => {
      const mockService = {
        complete: vi.fn().mockResolvedValue({
          content: "Configuration test successful!",
        }),
      };
      vi.mocked(MultiLLMService).mockImplementation(() => mockService as any);

      const result = await llmTestService.testConfiguration(
        mockConfig,
        mockLLMsConfig,
        "test"
      );

      expect(result).toBe(true);
      expect(mockService.complete).toHaveBeenCalledWith({
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. Respond with exactly: 'Configuration test successful!'",
          },
          {
            role: "user",
            content: "Please confirm this configuration works.",
          },
        ],
      });
    });

    it("should return false when provider is missing", async () => {
      const invalidConfig = { model: "gpt-4" } as LLMConfig;

      const result = await llmTestService.testConfiguration(
        invalidConfig,
        mockLLMsConfig
      );

      expect(result).toBe(false);
    });

    it("should return false when model is missing", async () => {
      const invalidConfig = { provider: "openai" } as LLMConfig;

      const result = await llmTestService.testConfiguration(
        invalidConfig,
        mockLLMsConfig
      );

      expect(result).toBe(false);
    });

    it("should return false when API key is missing for non-ollama provider", async () => {
      const configWithoutCreds: TenexLLMs = {
        ...mockLLMsConfig,
        credentials: {},
      };

      const result = await llmTestService.testConfiguration(
        mockConfig,
        configWithoutCreds
      );

      expect(result).toBe(false);
    });

    it("should allow missing API key for ollama provider", async () => {
      const ollamaConfig: LLMConfig = {
        provider: "ollama",
        model: "llama3",
      };

      const mockService = {
        complete: vi.fn().mockResolvedValue({
          content: "Configuration test successful!",
        }),
      };
      vi.mocked(MultiLLMService).mockImplementation(() => mockService as any);

      const result = await llmTestService.testConfiguration(
        ollamaConfig,
        mockLLMsConfig
      );

      expect(result).toBe(true);
    });

    it("should handle completion errors gracefully", async () => {
      const mockService = {
        complete: vi.fn().mockRejectedValue(new Error("API key invalid")),
      };
      vi.mocked(MultiLLMService).mockImplementation(() => mockService as any);

      const result = await llmTestService.testConfiguration(
        mockConfig,
        mockLLMsConfig
      );

      expect(result).toBe(false);
    });
  });
});