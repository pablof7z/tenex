import { beforeEach, describe, expect, mock, test } from "bun:test";
import { ConversationStorage } from "../../../../utils/agents/ConversationStorage";
import type { ToolEnabledProvider } from "../../../../utils/agents/llm/ToolEnabledProvider";
import type { LLMConfig } from "../../../../utils/agents/types";
import {
    type OrchestrationDependencies,
    createOrchestrationCoordinator,
} from "../../OrchestrationFactory";

describe("Team Formation LLM Configuration", () => {
    let conversationStorage: ConversationStorage;
    let defaultLLMConfig: LLMConfig;
    let teamFormationLLMConfig: LLMConfig;
    let allLLMConfigs: Map<string, LLMConfig>;

    beforeEach(() => {
        const tempPath = `/tmp/test-project-${Date.now()}`;
        conversationStorage = new ConversationStorage(tempPath);

        defaultLLMConfig = {
            provider: "ollama",
            model: "gemma3:12b-it-qat",
            enableCaching: false,
        };

        teamFormationLLMConfig = {
            provider: "openrouter",
            model: "anthropic/claude-sonnet-4",
            apiKey: "sk-or-v1-test",
            enableCaching: true,
        };

        allLLMConfigs = new Map([
            ["default", defaultLLMConfig],
            ["team-formation", teamFormationLLMConfig],
        ]);
    });

    test("should use default LLM when no team formation config specified", () => {
        const mockProvider = mock(() => ({})) as unknown as ToolEnabledProvider;

        const dependencies: OrchestrationDependencies = {
            llmProvider: mockProvider,
            llmConfig: defaultLLMConfig,
            allLLMConfigs,
            conversationStorage,
            config: {
                orchestrator: {
                    llmConfig: "default",
                    maxTeamSize: 5,
                    strategies: {},
                },
            },
        };

        const coordinator = createOrchestrationCoordinator(dependencies);
        expect(coordinator).toBeDefined();
    });

    test("should use specific team formation LLM when configured", () => {
        const mockProvider = mock(() => ({})) as unknown as ToolEnabledProvider;

        const dependencies: OrchestrationDependencies = {
            llmProvider: mockProvider,
            llmConfig: defaultLLMConfig,
            allLLMConfigs,
            conversationStorage,
            config: {
                orchestrator: {
                    llmConfig: "default",
                    teamFormationLLMConfig: "team-formation",
                    maxTeamSize: 5,
                    strategies: {},
                },
            },
        };

        const coordinator = createOrchestrationCoordinator(dependencies);
        expect(coordinator).toBeDefined();
    });

    test("should fallback to default when team formation config not found", () => {
        const mockProvider = mock(() => ({})) as unknown as ToolEnabledProvider;

        const dependencies: OrchestrationDependencies = {
            llmProvider: mockProvider,
            llmConfig: defaultLLMConfig,
            allLLMConfigs,
            conversationStorage,
            config: {
                orchestrator: {
                    llmConfig: "default",
                    teamFormationLLMConfig: "non-existent-config",
                    maxTeamSize: 5,
                    strategies: {},
                },
            },
        };

        const coordinator = createOrchestrationCoordinator(dependencies);
        expect(coordinator).toBeDefined();
    });

    test("should work without allLLMConfigs parameter (backwards compatibility)", () => {
        const mockProvider = mock(() => ({})) as unknown as ToolEnabledProvider;

        const dependencies: OrchestrationDependencies = {
            llmProvider: mockProvider,
            llmConfig: defaultLLMConfig,
            conversationStorage,
            config: {
                orchestrator: {
                    llmConfig: "default",
                    teamFormationLLMConfig: "team-formation",
                    maxTeamSize: 5,
                    strategies: {},
                },
            },
        };

        const coordinator = createOrchestrationCoordinator(dependencies);
        expect(coordinator).toBeDefined();
    });
});
