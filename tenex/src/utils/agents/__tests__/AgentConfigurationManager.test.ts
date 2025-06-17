import { promises as fsPromises } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AgentsJson } from "@tenex/types/agents";
import type { LLMConfig } from "@tenex/types/llm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgentConfigurationManager } from "../AgentConfigurationManager";

describe("AgentConfigurationManager", () => {
    let tempDir: string;
    let manager: AgentConfigurationManager;

    beforeEach(async () => {
        // Create a temporary directory for tests
        tempDir = mkdtempSync(path.join(tmpdir(), "agent-config-test-"));
        const tenexDir = path.join(tempDir, ".tenex");
        await fsPromises.mkdir(tenexDir, { recursive: true });

        // Create a minimal config.json to prevent config loading errors
        const configPath = path.join(tenexDir, "config.json");
        await fsPromises.writeFile(
            configPath,
            JSON.stringify(
                {
                    title: "Test Project",
                    projectNaddr: "test-naddr",
                    projectPubkey: "test-npub",
                    projectNsec: "test-nsec",
                },
                null,
                2
            )
        );

        manager = new AgentConfigurationManager(tempDir);
    });

    afterEach(() => {
        // Clean up temp directory
        if (tempDir) {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe("initialization", () => {
        it("should initialize with empty configurations when no llms.json exists", async () => {
            await manager.initialize();

            expect(manager.getLLMConfig()).toBeUndefined();
            expect(manager.getAllLLMConfigs().size).toBe(0);
        });

        it("should load LLM configurations from llms.json", async () => {
            const mockLLMConfigs = {
                configurations: {
                    claude: {
                        provider: "anthropic",
                        model: "claude-3-opus-20240229",
                        apiKey: "test-key",
                    },
                    gpt4: {
                        provider: "openai",
                        model: "gpt-4",
                        apiKey: "test-key",
                    },
                },
                defaults: {
                    default: "claude",
                },
            };

            const llmsPath = path.join(tempDir, ".tenex", "llms.json");
            await fsPromises.writeFile(llmsPath, JSON.stringify(mockLLMConfigs, null, 2));

            await manager.initialize();

            const defaultConfig = manager.getLLMConfig();
            expect(defaultConfig).toEqual({
                provider: "anthropic",
                model: "claude-3-opus-20240229",
                apiKey: "test-key",
            });

            const allConfigs = manager.getAllLLMConfigs();
            expect(allConfigs.size).toBe(2);
        });

        it("should handle default config as object", async () => {
            const mockLLMConfigs = {
                configurations: {
                    default: {
                        provider: "openai",
                        model: "gpt-4",
                        apiKey: "test-key",
                    },
                },
                defaults: {
                    default: "default",
                },
            };

            const llmsPath = path.join(tempDir, ".tenex", "llms.json");
            await fsPromises.writeFile(llmsPath, JSON.stringify(mockLLMConfigs, null, 2));

            await manager.initialize();

            const defaultConfig = manager.getLLMConfig();
            expect(defaultConfig).toEqual({
                provider: "openai",
                model: "gpt-4",
                apiKey: "test-key",
            });
        });
    });

    describe("getLLMConfig", () => {
        beforeEach(async () => {
            const mockLLMConfigs = {
                configurations: {
                    claude: {
                        provider: "anthropic",
                        model: "claude-3-opus-20240229",
                        apiKey: "test-key",
                    },
                    gpt4: {
                        provider: "openai",
                        model: "gpt-4",
                        apiKey: "test-key",
                    },
                },
                defaults: {
                    default: "claude",
                },
            };

            const llmsPath = path.join(tempDir, ".tenex", "llms.json");
            await fsPromises.writeFile(llmsPath, JSON.stringify(mockLLMConfigs, null, 2));
            await manager.initialize();
        });

        it("should get specific LLM config by name", () => {
            const gpt4Config = manager.getLLMConfig("gpt4");
            expect(gpt4Config).toEqual({
                provider: "openai",
                model: "gpt-4",
                apiKey: "test-key",
            });
        });

        it("should resolve config references", () => {
            const defaultConfig = manager.getLLMConfig("default");
            expect(defaultConfig).toEqual({
                provider: "anthropic",
                model: "claude-3-opus-20240229",
                apiKey: "test-key",
            });
        });

        it("should return undefined for non-existent config", () => {
            const config = manager.getLLMConfig("nonexistent");
            expect(config).toBeUndefined();
        });

        it("should return default config when no name provided", () => {
            const config = manager.getLLMConfig();
            expect(config).toEqual({
                provider: "anthropic",
                model: "claude-3-opus-20240229",
                apiKey: "test-key",
            });
        });
    });

    describe("getLLMConfigForAgent", () => {
        beforeEach(async () => {
            const mockLLMConfigs = {
                configurations: {
                    claude: {
                        provider: "anthropic",
                        model: "claude-3-opus-20240229",
                        apiKey: "test-key",
                    },
                    planner: {
                        provider: "openai",
                        model: "gpt-4",
                        apiKey: "test-key",
                    },
                },
                defaults: {
                    default: "claude",
                    planner: "planner",
                },
            };

            const llmsPath = path.join(tempDir, ".tenex", "llms.json");
            await fsPromises.writeFile(llmsPath, JSON.stringify(mockLLMConfigs, null, 2));
            await manager.initialize();
        });

        it("should get agent-specific LLM config", () => {
            const config = manager.getLLMConfigForAgent("planner");
            expect(config).toEqual({
                provider: "openai",
                model: "gpt-4",
                apiKey: "test-key",
            });
        });

        it("should fall back to default for agents without specific config", () => {
            const config = manager.getLLMConfigForAgent("debugger");
            expect(config).toEqual({
                provider: "anthropic",
                model: "claude-3-opus-20240229",
                apiKey: "test-key",
            });
        });
    });

    describe("updateAgentLLMConfig", () => {
        beforeEach(async () => {
            const mockLLMConfigs = {
                configurations: {
                    claude: {
                        provider: "anthropic",
                        model: "claude-3-opus-20240229",
                        apiKey: "test-key",
                    },
                    gpt4: {
                        provider: "openai",
                        model: "gpt-4",
                        apiKey: "test-key",
                    },
                },
                defaults: {
                    default: "claude",
                },
            };

            const llmsPath = path.join(tempDir, ".tenex", "llms.json");
            await fsPromises.writeFile(llmsPath, JSON.stringify(mockLLMConfigs, null, 2));
            await manager.initialize();
        });

        it("should update agent LLM config at runtime", async () => {
            const result = await manager.updateAgentLLMConfig("planner", "gpt4");
            expect(result).toBe(true);

            const config = manager.getLLMConfigForAgent("planner");
            expect(config).toEqual({
                provider: "openai",
                model: "gpt-4",
                apiKey: "test-key",
            });
        });

        it("should return false for non-existent config", async () => {
            const result = await manager.updateAgentLLMConfig("planner", "nonexistent");
            expect(result).toBe(false);
        });
    });

    describe("agents.json operations", () => {
        it("should load agents configuration", async () => {
            const mockAgentsConfig: AgentsJson = {
                default: { nsec: "nsec1default" },
                code: {
                    nsec: "nsec1code",
                    file: "code-agent.json",
                },
                planner: {
                    nsec: "nsec1planner",
                    file: "planner-agent.json",
                },
            };

            const agentsPath = path.join(tempDir, ".tenex", "agents.json");
            await fsPromises.writeFile(agentsPath, JSON.stringify(mockAgentsConfig, null, 2));

            const config = await manager.loadAgentsConfig();
            expect(config).toEqual(mockAgentsConfig);
        });

        it("should return empty object when agents.json not found", async () => {
            const config = await manager.loadAgentsConfig();
            expect(config).toEqual({});
        });

        it("should get specific agent config entry", async () => {
            const mockAgentsConfig: AgentsJson = {
                default: { nsec: "nsec1default" },
                code: {
                    nsec: "nsec1code",
                    file: "code-agent.json",
                },
            };

            const agentsPath = path.join(tempDir, ".tenex", "agents.json");
            await fsPromises.writeFile(agentsPath, JSON.stringify(mockAgentsConfig, null, 2));

            const entry = await manager.getAgentConfigEntry("code");
            expect(entry).toEqual({
                nsec: "nsec1code",
                file: "code-agent.json",
            });
        });
    });

    describe("loadAgentDefinition", () => {
        it("should load agent definition with .json extension", async () => {
            const mockAgentDef = {
                name: "Code Agent",
                description: "Handles code implementation",
                role: "Software engineer",
                instructions: "Write clean code",
                version: "1.0.0",
            };

            const agentsDir = path.join(tempDir, ".tenex", "agents");
            await fsPromises.mkdir(agentsDir, { recursive: true });
            const agentDefPath = path.join(agentsDir, "agent123.json");
            await fsPromises.writeFile(agentDefPath, JSON.stringify(mockAgentDef, null, 2));

            const def = await manager.loadAgentDefinition("agent123.json");
            expect(def).toEqual(mockAgentDef);
        });

        it("should load agent definition without .json extension", async () => {
            const mockAgentDef = {
                name: "Code Agent",
                description: "Handles code implementation",
                role: "Software engineer",
                instructions: "Write clean code",
                version: "1.0.0",
            };

            const agentsDir = path.join(tempDir, ".tenex", "agents");
            await fsPromises.mkdir(agentsDir, { recursive: true });
            const agentDefPath = path.join(agentsDir, "agent123.json");
            await fsPromises.writeFile(agentDefPath, JSON.stringify(mockAgentDef, null, 2));

            const def = await manager.loadAgentDefinition("agent123");
            expect(def).toEqual(mockAgentDef);
        });

        it("should return undefined when agent definition not found", async () => {
            const def = await manager.loadAgentDefinition("nonexistent");
            expect(def).toBeUndefined();
        });

        it("should handle agent definitions with partial fields", async () => {
            const mockAgentDef = {
                name: "Minimal Agent",
                // Only name is provided
            };

            const agentsDir = path.join(tempDir, ".tenex", "agents");
            await fsPromises.mkdir(agentsDir, { recursive: true });
            const agentDefPath = path.join(agentsDir, "minimal.json");
            await fsPromises.writeFile(agentDefPath, JSON.stringify(mockAgentDef, null, 2));

            const def = await manager.loadAgentDefinition("minimal");
            expect(def).toEqual({
                name: "Minimal Agent",
            });
        });
    });

    describe("loadAgentSpecificConfig", () => {
        it("should load agent-specific config", async () => {
            const mockConfig = {
                description: "Debug agent for troubleshooting",
                role: "Debugger",
                instructions: "Find and fix bugs",
            };

            const agentsDir = path.join(tempDir, ".tenex", "agents");
            await fsPromises.mkdir(agentsDir, { recursive: true });
            const configPath = path.join(agentsDir, "debugger.json");
            await fsPromises.writeFile(configPath, JSON.stringify(mockConfig, null, 2));

            const config = await manager.loadAgentSpecificConfig("debugger");
            expect(config).toEqual(mockConfig);
        });

        it("should return undefined when agent config not found", async () => {
            const config = await manager.loadAgentSpecificConfig("nonexistent");
            expect(config).toBeUndefined();
        });
    });

    describe("circular reference handling", () => {
        it("should handle circular references in LLM configs", async () => {
            const mockLLMConfigs = {
                configurations: {
                    config1: {
                        provider: "openai",
                        model: "gpt-4",
                        apiKey: "test-key",
                    },
                    config2: {
                        provider: "anthropic",
                        model: "claude-3",
                        apiKey: "test-key",
                    },
                },
                defaults: {
                    default: "config1",
                    config1: "config2",
                    config2: "config1",
                },
            };

            const llmsPath = path.join(tempDir, ".tenex", "llms.json");
            await fsPromises.writeFile(llmsPath, JSON.stringify(mockLLMConfigs, null, 2));
            await manager.initialize();

            const config = manager.getLLMConfig("config1");
            expect(config).toBeUndefined();
        });
    });

    describe("edge cases", () => {
        it("should handle empty llms.json", async () => {
            const llmsPath = path.join(tempDir, ".tenex", "llms.json");
            await fsPromises.writeFile(
                llmsPath,
                JSON.stringify({ configurations: {}, defaults: {} }, null, 2)
            );
            await manager.initialize();

            expect(manager.getLLMConfig()).toBeUndefined();
            expect(manager.getAllLLMConfigs().size).toBe(0);
        });

        it("should handle malformed JSON gracefully", async () => {
            const llmsPath = path.join(tempDir, ".tenex", "llms.json");
            await fsPromises.writeFile(llmsPath, "{ invalid json");
            await manager.initialize();

            expect(manager.getLLMConfig()).toBeUndefined();
        });
    });

    describe("getters", () => {
        it("should get project path", () => {
            expect(manager.getProjectPath()).toBe(tempDir);
        });

        it("should get default LLM name", async () => {
            const mockLLMConfigs = {
                configurations: {
                    claude: {
                        provider: "anthropic",
                        model: "claude-3-opus-20240229",
                        apiKey: "test-key",
                    },
                },
                defaults: {
                    default: "claude",
                },
            };

            const llmsPath = path.join(tempDir, ".tenex", "llms.json");
            await fsPromises.writeFile(llmsPath, JSON.stringify(mockLLMConfigs, null, 2));
            await manager.initialize();

            expect(manager.getDefaultLLMName()).toBe("claude");
        });
    });

    describe("read/write integration", () => {
        it("should persist and reload configurations", async () => {
            // Write configuration
            const mockLLMConfigs = {
                configurations: {
                    claude: {
                        provider: "anthropic",
                        model: "claude-3-opus-20240229",
                        apiKey: "test-key",
                        enableCaching: true,
                        contextWindowSize: 200000,
                    },
                    gpt4: {
                        provider: "openai",
                        model: "gpt-4-turbo",
                        apiKey: "test-key-2",
                    },
                },
                defaults: {
                    default: "claude",
                },
            };

            const mockAgentsConfig: AgentsJson = {
                default: {
                    nsec: "nsec1default",
                    file: "default-agent.json",
                },
                code: {
                    nsec: "nsec1code",
                    file: "code-agent.json",
                },
            };

            // Write configs
            const llmsPath = path.join(tempDir, ".tenex", "llms.json");
            const agentsPath = path.join(tempDir, ".tenex", "agents.json");
            await fsPromises.writeFile(llmsPath, JSON.stringify(mockLLMConfigs, null, 2));
            await fsPromises.writeFile(agentsPath, JSON.stringify(mockAgentsConfig, null, 2));

            // Write agent definitions
            const agentsDir = path.join(tempDir, ".tenex", "agents");
            await fsPromises.mkdir(agentsDir, { recursive: true });

            const defaultAgentDef = {
                name: "Default Agent",
                description: "The primary agent",
                role: "General purpose assistant",
                instructions: "Be helpful",
                version: "1.0.0",
            };

            const codeAgentDef = {
                name: "Code Agent",
                description: "Code specialist",
                role: "Software engineer",
                instructions: "Write clean, tested code",
                version: "2.0.0",
            };

            await fsPromises.writeFile(
                path.join(agentsDir, "default-agent.json"),
                JSON.stringify(defaultAgentDef, null, 2)
            );
            await fsPromises.writeFile(
                path.join(agentsDir, "code-agent.json"),
                JSON.stringify(codeAgentDef, null, 2)
            );

            // Initialize and verify
            await manager.initialize();

            // Verify LLM configs
            expect(manager.getLLMConfig()).toEqual(mockLLMConfigs.claude);
            expect(manager.getLLMConfig("gpt4")).toEqual(mockLLMConfigs.gpt4);

            // Verify agent configs
            const agentsConfig = await manager.loadAgentsConfig();
            expect(agentsConfig).toEqual(mockAgentsConfig);

            // Verify agent definitions
            const defaultDef = await manager.loadAgentDefinition("default-agent.json");
            expect(defaultDef).toEqual(defaultAgentDef);

            const codeDef = await manager.loadAgentDefinition("code-agent");
            expect(codeDef).toEqual(codeAgentDef);

            // Test runtime updates
            manager.updateAgentLLMConfig("code", "gpt4");
            expect(manager.getLLMConfigForAgent("code")).toEqual(mockLLMConfigs.gpt4);
        });
    });
});
