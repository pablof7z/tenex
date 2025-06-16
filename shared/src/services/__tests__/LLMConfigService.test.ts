import type { LLMConfig, LLMConfigs } from "@tenex/types/llm";
import { describe, expect, it } from "vitest";
import { LLMConfigService } from "../LLMConfigService";

describe("LLMConfigService", () => {
    describe("constructor", () => {
        it("should create an empty service", () => {
            const service = new LLMConfigService();
            expect(service.getAllConfigs().size).toBe(0);
        });

        it("should load configs from constructor", () => {
            const configs: LLMConfigs = {
                default: "openai",
                openai: {
                    provider: "openai",
                    model: "gpt-4",
                    apiKey: "test-key",
                },
            };

            const service = new LLMConfigService(configs);
            // Should have 1 config (openai) + 1 reference (default -> openai) = 2 entries
            const allConfigs = service.getAllConfigs();
            expect(allConfigs.size).toBe(2);
            expect(allConfigs.has("openai")).toBe(true);
            expect(allConfigs.has("default")).toBe(true);
            expect(allConfigs.get("default")).toBe(allConfigs.get("openai")); // Same reference
            expect(service.getDefaultConfigName()).toBe("openai");
        });
    });

    describe("loadConfigs", () => {
        it("should load multiple configurations", () => {
            const configs: LLMConfigs = {
                openai: {
                    provider: "openai",
                    model: "gpt-4",
                    apiKey: "test-key",
                },
                anthropic: {
                    provider: "anthropic",
                    model: "claude-3-opus-20240229",
                    apiKey: "test-key",
                },
            };

            const service = new LLMConfigService();
            service.loadConfigs(configs);

            expect(service.getAllConfigs().size).toBe(2);
            expect(service.getConfig("openai")?.provider).toBe("openai");
            expect(service.getConfig("anthropic")?.provider).toBe("anthropic");
        });

        it("should handle default as full config", () => {
            const configs: LLMConfigs = {
                default: {
                    provider: "openrouter",
                    model: "gpt-4",
                    apiKey: "test-key",
                },
            };

            const service = new LLMConfigService();
            service.loadConfigs(configs);

            expect(service.getDefaultConfigName()).toBe("default");
            expect(service.getConfig()?.provider).toBe("openrouter");
        });

        it("should resolve config references", () => {
            const configs: LLMConfigs = {
                default: "main",
                main: {
                    provider: "openai",
                    model: "gpt-4",
                    apiKey: "test-key",
                },
                alias: "main",
            };

            const service = new LLMConfigService();
            service.loadConfigs(configs);

            expect(service.getConfig("alias")).toEqual(service.getConfig("main"));
            expect(service.getDefaultConfigName()).toBe("main");
        });

        it("should throw on invalid reference", () => {
            const configs: LLMConfigs = {
                alias: "nonexistent",
            };

            const service = new LLMConfigService();
            expect(() => service.loadConfigs(configs)).toThrow(
                'Configuration "alias" references non-existent config "nonexistent"'
            );
        });
    });

    describe("validateConfig", () => {
        it("should validate valid config", () => {
            const service = new LLMConfigService();
            const config = {
                provider: "openai",
                model: "gpt-4",
                apiKey: "test-key",
                temperature: 0.5,
            };

            const validated = service.validateConfig(config);
            expect(validated.provider).toBe("openai");
            expect(validated.temperature).toBe(0.5);
        });

        it("should apply provider defaults", () => {
            const service = new LLMConfigService();
            const config = {
                provider: "anthropic",
                model: "claude-3",
                apiKey: "test-key",
            };

            const validated = service.validateConfig(config);
            expect(validated.temperature).toBe(0.7); // default
            expect(validated.maxTokens).toBe(4096); // default
            expect(validated.enableCaching).toBe(true); // anthropic default
        });

        it("should reject invalid provider", () => {
            const service = new LLMConfigService();
            const config = {
                provider: "invalid",
                model: "test",
            };

            expect(() => service.validateConfig(config)).toThrow("Invalid LLM configuration");
        });

        it("should reject invalid temperature", () => {
            const service = new LLMConfigService();
            const config = {
                provider: "openai",
                model: "gpt-4",
                temperature: 3, // > 2
            };

            expect(() => service.validateConfig(config)).toThrow("Invalid LLM configuration");
        });
    });

    describe("config management", () => {
        it("should add and retrieve config", () => {
            const service = new LLMConfigService();
            const config: LLMConfig = {
                provider: "openai",
                model: "gpt-4",
                apiKey: "test-key",
            };

            service.setConfig("test", config);
            expect(service.getConfig("test")).toBeDefined();
            expect(service.getConfig("test")?.model).toBe("gpt-4");
        });

        it("should remove config", () => {
            const service = new LLMConfigService();
            const config: LLMConfig = {
                provider: "openai",
                model: "gpt-4",
                apiKey: "test-key",
            };

            service.setConfig("test", config);
            expect(service.removeConfig("test")).toBe(true);
            expect(service.getConfig("test")).toBeUndefined();
        });

        it("should set default config", () => {
            const service = new LLMConfigService();
            const config: LLMConfig = {
                provider: "openai",
                model: "gpt-4",
                apiKey: "test-key",
            };

            service.setConfig("test", config);
            service.setDefaultConfig("test");
            expect(service.getDefaultConfigName()).toBe("test");
            expect(service.getConfig()).toBeDefined();
        });

        it("should throw when setting non-existent default", () => {
            const service = new LLMConfigService();
            expect(() => service.setDefaultConfig("nonexistent")).toThrow(
                'Cannot set default to non-existent config "nonexistent"'
            );
        });
    });

    describe("mergeConfigs", () => {
        it("should merge configurations", () => {
            const service = new LLMConfigService();
            const base: LLMConfig = {
                provider: "openai",
                model: "gpt-4",
                apiKey: "test-key",
                temperature: 0.7,
                maxTokens: 2000,
            };

            const overrides = {
                temperature: 0.9,
                maxTokens: 4000,
            };

            const merged = service.mergeConfigs(base, overrides);
            expect(merged.temperature).toBe(0.9);
            expect(merged.maxTokens).toBe(4000);
            expect(merged.apiKey).toBe("test-key");
        });
    });

    describe("exportConfigs", () => {
        it("should export all configurations", () => {
            const service = new LLMConfigService();
            service.setConfig("openai", {
                provider: "openai",
                model: "gpt-4",
                apiKey: "test-key",
            });
            service.setConfig("anthropic", {
                provider: "anthropic",
                model: "claude-3",
                apiKey: "test-key",
            });
            service.setDefaultConfig("openai");

            const exported = service.exportConfigs();
            expect(exported.default).toBe("openai");
            expect(exported.openai).toBeDefined();
            expect(exported.anthropic).toBeDefined();
        });
    });

    describe("validation helpers", () => {
        it("should detect when API key is required", () => {
            const service = new LLMConfigService();

            const needsKey: LLMConfig = {
                provider: "openai",
                model: "gpt-4",
            };
            expect(service.requiresApiKey(needsKey)).toBe(true);

            const hasKey: LLMConfig = {
                provider: "openai",
                model: "gpt-4",
                apiKey: "test-key",
            };
            expect(service.requiresApiKey(hasKey)).toBe(false);

            const localOllama: LLMConfig = {
                provider: "openai", // Ollama uses OpenAI-compatible API
                model: "llama2",
                baseURL: "http://localhost:11434",
            };
            expect(service.requiresApiKey(localOllama)).toBe(false);
        });

        it("should validate config for use", () => {
            const service = new LLMConfigService();

            const invalid: LLMConfig = {
                provider: "openai",
                model: "",
            };
            const result1 = service.validateForUse(invalid);
            expect(result1.valid).toBe(false);
            expect(result1.errors).toContain("Model is required");
            expect(result1.errors).toContain("API key is required for openai");

            const valid: LLMConfig = {
                provider: "openai",
                model: "gpt-4",
                apiKey: "test-key",
            };
            const result2 = service.validateForUse(valid);
            expect(result2.valid).toBe(true);
            expect(result2.errors).toHaveLength(0);
        });
    });
});
