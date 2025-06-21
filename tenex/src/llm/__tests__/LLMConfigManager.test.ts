import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { LLMConfigManager } from "../LLMConfigManager";
import { fileExists, readFile, writeJsonFile } from "@tenex/shared/fs";
import type { LLMConfig } from "@/types/llm";
import { vol } from "memfs";

// Mock the file system
jest.mock("@tenex/shared/fs");

describe("LLMConfigManager", () => {
  let manager: LLMConfigManager;
  const testProjectPath = "/test/project";
  const testLLMsPath = `${testProjectPath}/llms.json`;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    manager = new LLMConfigManager(testProjectPath);
  });

  describe("loadConfigurations", () => {
    it("should load configurations from llms.json", async () => {
      const mockConfigs = {
        default: {
          provider: "anthropic",
          model: "claude-3-opus-20240229",
          temperature: 0.7,
        },
        fast: {
          provider: "openai",
          model: "gpt-3.5-turbo",
          temperature: 0.5,
        },
      };

      mock.module("@tenex/shared/fs", () => ({
        fileExists: jest.fn().mockResolvedValue(true),
        readFile: jest.fn().mockResolvedValue(JSON.stringify(mockConfigs)),
        writeJsonFile: jest.fn(),
      }));

      await manager.loadConfigurations();

      expect(fileExists).toHaveBeenCalledWith(testLLMsPath);
      expect(readFile).toHaveBeenCalledWith(testLLMsPath, "utf-8");
      
      const defaultConfig = manager.getConfig("default");
      expect(defaultConfig).toEqual(mockConfigs.default);
      
      const fastConfig = manager.getConfig("fast");
      expect(fastConfig).toEqual(mockConfigs.fast);
    });

    it("should handle missing llms.json file", async () => {
      mock.module("@tenex/shared/fs", () => ({
        fileExists: jest.fn().mockResolvedValue(false),
        readFile: jest.fn(),
        writeJsonFile: jest.fn(),
      }));

      await manager.loadConfigurations();

      expect(fileExists).toHaveBeenCalledWith(testLLMsPath);
      expect(readFile).not.toHaveBeenCalled();
      
      const configs = manager.getAllConfigs();
      expect(configs.size).toBe(0);
    });

    it("should handle invalid JSON in llms.json", async () => {
      mock.module("@tenex/shared/fs", () => ({
        fileExists: jest.fn().mockResolvedValue(true),
        readFile: jest.fn().mockResolvedValue("invalid json"),
        writeJsonFile: jest.fn(),
      }));

      await expect(manager.loadConfigurations()).rejects.toThrow();
    });

    it("should merge environment variables with loaded configs", async () => {
      const mockConfigs = {
        default: {
          provider: "anthropic",
          model: "claude-3-opus-20240229",
          temperature: 0.7,
        },
      };

      process.env.ANTHROPIC_API_KEY = "test-api-key";

      mock.module("@tenex/shared/fs", () => ({
        fileExists: jest.fn().mockResolvedValue(true),
        readFile: jest.fn().mockResolvedValue(JSON.stringify(mockConfigs)),
        writeJsonFile: jest.fn(),
      }));

      await manager.loadConfigurations();

      const defaultConfig = manager.getConfig("default");
      expect(defaultConfig?.apiKey).toBe("test-api-key");

      delete process.env.ANTHROPIC_API_KEY;
    });
  });

  describe("config management", () => {
    beforeEach(async () => {
      const mockConfigs = {
        default: {
          provider: "anthropic",
          model: "claude-3-opus-20240229",
          temperature: 0.7,
        },
      };

      mock.module("@tenex/shared/fs", () => ({
        fileExists: jest.fn().mockResolvedValue(true),
        readFile: jest.fn().mockResolvedValue(JSON.stringify(mockConfigs)),
        writeJsonFile: jest.fn(),
      }));

      await manager.loadConfigurations();
    });

    it("should get config by name", () => {
      const config = manager.getConfig("default");
      expect(config).toBeDefined();
      expect(config?.provider).toBe("anthropic");
    });

    it("should return undefined for non-existent config", () => {
      const config = manager.getConfig("nonexistent");
      expect(config).toBeUndefined();
    });

    it("should get default config", () => {
      const config = manager.getDefaultConfig();
      expect(config).toBeDefined();
      expect(config?.provider).toBe("anthropic");
    });

    it("should get all configs", () => {
      const configs = manager.getAllConfigs();
      expect(configs.size).toBe(1);
      expect(configs.has("default")).toBe(true);
    });

    it("should add new config", async () => {
      const newConfig: LLMConfig = {
        provider: "openai",
        model: "gpt-4",
        temperature: 0.8,
      };

      await manager.addConfig("custom", newConfig);

      const config = manager.getConfig("custom");
      expect(config).toEqual(newConfig);
      
      // Verify it was saved to file
      expect(writeJsonFile).toHaveBeenCalled();
    });

    it("should update existing config", async () => {
      const updatedConfig: LLMConfig = {
        provider: "anthropic",
        model: "claude-3-sonnet-20240229",
        temperature: 0.9,
      };

      await manager.updateConfig("default", updatedConfig);

      const config = manager.getConfig("default");
      expect(config).toEqual(updatedConfig);
      expect(writeJsonFile).toHaveBeenCalled();
    });

    it("should throw when updating non-existent config", async () => {
      const config: LLMConfig = {
        provider: "openai",
        model: "gpt-4",
        temperature: 0.8,
      };

      await expect(manager.updateConfig("nonexistent", config)).rejects.toThrow();
    });

    it("should remove config", async () => {
      await manager.removeConfig("default");

      const config = manager.getConfig("default");
      expect(config).toBeUndefined();
      expect(writeJsonFile).toHaveBeenCalled();
    });
  });

  describe("validation", () => {
    it("should validate config has required fields", async () => {
      const invalidConfig = {
        provider: "anthropic",
        // missing model
        temperature: 0.7,
      } as LLMConfig;

      await expect(manager.addConfig("invalid", invalidConfig)).rejects.toThrow();
    });

    it("should validate provider is supported", async () => {
      const invalidConfig: LLMConfig = {
        provider: "unsupported" as any,
        model: "some-model",
        temperature: 0.7,
      };

      await expect(manager.addConfig("invalid", invalidConfig)).rejects.toThrow();
    });

    it("should validate temperature is in valid range", async () => {
      const invalidConfig: LLMConfig = {
        provider: "anthropic",
        model: "claude-3-opus-20240229",
        temperature: 2.5, // invalid - should be 0-2
      };

      await expect(manager.addConfig("invalid", invalidConfig)).rejects.toThrow();
    });
  });

  describe("environment variable handling", () => {
    it("should handle different provider API keys", async () => {
      process.env.ANTHROPIC_API_KEY = "anthropic-key";
      process.env.OPENAI_API_KEY = "openai-key";
      process.env.OLLAMA_HOST = "http://localhost:11434";
      process.env.OPENROUTER_API_KEY = "openrouter-key";

      const configs = {
        anthropic: { provider: "anthropic", model: "claude-3-opus-20240229" },
        openai: { provider: "openai", model: "gpt-4" },
        ollama: { provider: "ollama", model: "llama2" },
        openrouter: { provider: "openrouter", model: "meta-llama/llama-2-70b-chat" },
      };

      mock.module("@tenex/shared/fs", () => ({
        fileExists: jest.fn().mockResolvedValue(true),
        readFile: jest.fn().mockResolvedValue(JSON.stringify(configs)),
        writeJsonFile: jest.fn(),
      }));

      await manager.loadConfigurations();

      expect(manager.getConfig("anthropic")?.apiKey).toBe("anthropic-key");
      expect(manager.getConfig("openai")?.apiKey).toBe("openai-key");
      expect(manager.getConfig("ollama")?.baseURL).toBe("http://localhost:11434");
      expect(manager.getConfig("openrouter")?.apiKey).toBe("openrouter-key");

      // Cleanup
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.OLLAMA_HOST;
      delete process.env.OPENROUTER_API_KEY;
    });
  });
});