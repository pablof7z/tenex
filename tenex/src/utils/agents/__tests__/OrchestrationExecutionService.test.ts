import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { LLMConfig } from "@tenex/types/llm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrchestrationCoordinator } from "../../../core/orchestration/integration/OrchestrationCoordinator";
import type { StrategyExecutionResult } from "../../../core/orchestration/strategies/OrchestrationStrategy";
import { OrchestrationStrategy, type Team } from "../../../core/orchestration/types";
import type { Agent } from "../Agent";
import type { AgentConfigurationManager } from "../AgentConfigurationManager";
import type { EnhancedResponsePublisher } from "../EnhancedResponsePublisher";
import { OrchestrationExecutionService } from "../OrchestrationExecutionService";

describe("OrchestrationExecutionService", () => {
    let service: OrchestrationExecutionService;
    let mockOrchestrationCoordinator: OrchestrationCoordinator;
    let mockResponsePublisher: EnhancedResponsePublisher;
    let mockConfigManager: AgentConfigurationManager;
    let mockEvent: NDKEvent;
    let mockLLMConfig: LLMConfig;

    beforeEach(() => {
        mockOrchestrationCoordinator = {
            executeTeamStrategy: vi.fn().mockResolvedValue({
                success: true,
                responses: [
                    {
                        agentName: "agent1",
                        response: "Response from agent1",
                        timestamp: Date.now(),
                    },
                ],
                errors: [],
                metadata: {},
            } as StrategyExecutionResult),
        } as unknown as OrchestrationCoordinator;

        mockResponsePublisher = {
            publishStrategyResponses: vi.fn(),
        } as unknown as EnhancedResponsePublisher;

        mockConfigManager = {
            getLLMConfig: vi.fn().mockReturnValue({
                provider: "test",
                model: "test-model",
                apiKey: "test-key",
            }),
            getAllLLMConfigs: vi
                .fn()
                .mockReturnValue(new Map([["default", { provider: "test", model: "test-model" }]])),
            getDefaultLLMName: vi.fn().mockReturnValue("default"),
        } as unknown as AgentConfigurationManager;

        mockEvent = {
            id: "event123",
            content: "Test message",
            author: { pubkey: "userpubkey" },
        } as NDKEvent;

        mockLLMConfig = {
            provider: "test",
            model: "test-model",
            apiKey: "test-key",
        } as LLMConfig;

        service = new OrchestrationExecutionService(
            mockOrchestrationCoordinator,
            mockResponsePublisher,
            mockConfigManager
        );
    });

    describe("executeOrchestrationStrategy", () => {
        it("should execute team strategy and publish responses", async () => {
            const mockTeam: Team = {
                id: "team123",
                conversationId: "conv123",
                lead: "agent1",
                members: ["agent1", "agent2"],
                strategy: OrchestrationStrategy.PARALLEL_EXECUTION,
                formation: {
                    timestamp: Date.now(),
                    reasoning: "Test team",
                    requestAnalysis: {
                        requestType: "test",
                        requiredCapabilities: ["testing"],
                        estimatedComplexity: 5,
                        suggestedStrategy: OrchestrationStrategy.PARALLEL_EXECUTION,
                        reasoning: "Test analysis",
                    },
                },
            };

            const mockAgents = new Map([
                ["agent1", { getName: () => "agent1" } as Agent],
                ["agent2", { getName: () => "agent2" } as Agent],
            ]);

            await service.executeOrchestrationStrategy(
                mockTeam,
                mockEvent,
                mockAgents,
                "conv123",
                mockLLMConfig
            );

            expect(mockOrchestrationCoordinator.executeTeamStrategy).toHaveBeenCalledWith(
                mockTeam,
                mockEvent,
                mockAgents
            );
            expect(mockResponsePublisher.publishStrategyResponses).toHaveBeenCalled();
        });
    });

    describe("executeIndividualResponses", () => {
        it("should call processAgentResponsesFn for individual responses", async () => {
            const mockAgents = [
                { getName: () => "agent1" } as Agent,
                { getName: () => "agent2" } as Agent,
            ];

            const mockProcessAgentResponsesFn = vi.fn();
            const mockNDK = {};

            await service.executeIndividualResponses(
                mockAgents,
                mockEvent,
                "conv123",
                mockLLMConfig,
                false,
                mockProcessAgentResponsesFn,
                mockNDK
            );

            expect(mockProcessAgentResponsesFn).toHaveBeenCalledWith(
                mockAgents,
                mockEvent,
                mockNDK,
                "conv123",
                mockLLMConfig,
                false
            );
        });
    });

    describe("executeResponseStrategy", () => {
        it("should use orchestration strategy when team is provided", async () => {
            const mockTeam: Team = {
                id: "team123",
                conversationId: "conv123",
                lead: "agent1",
                members: ["agent1"],
                strategy: OrchestrationStrategy.SINGLE_RESPONDER,
                formation: {
                    timestamp: Date.now(),
                    reasoning: "Test team",
                    requestAnalysis: {
                        requestType: "test",
                        requiredCapabilities: ["testing"],
                        estimatedComplexity: 3,
                        suggestedStrategy: OrchestrationStrategy.SINGLE_RESPONDER,
                        reasoning: "Simple task",
                    },
                },
            };

            const result = {
                agents: [{ getName: () => "agent1" } as Agent],
                team: mockTeam,
            };

            const mockProcessAgentResponsesFn = vi.fn();
            const mockNDK = {};

            await service.executeResponseStrategy(
                result,
                mockEvent,
                "conv123",
                mockLLMConfig,
                false,
                mockProcessAgentResponsesFn,
                mockNDK
            );

            expect(mockOrchestrationCoordinator.executeTeamStrategy).toHaveBeenCalled();
            expect(mockProcessAgentResponsesFn).not.toHaveBeenCalled();
        });

        it("should use individual responses when no team is provided", async () => {
            const result = {
                agents: [{ getName: () => "agent1" } as Agent],
            };

            const mockProcessAgentResponsesFn = vi.fn();
            const mockNDK = {};

            await service.executeResponseStrategy(
                result,
                mockEvent,
                "conv123",
                mockLLMConfig,
                false,
                mockProcessAgentResponsesFn,
                mockNDK
            );

            expect(mockOrchestrationCoordinator.executeTeamStrategy).not.toHaveBeenCalled();
            expect(mockProcessAgentResponsesFn).toHaveBeenCalled();
        });
    });

    describe("logResultInfo", () => {
        it("should log agent determination results", () => {
            const result = {
                agents: [
                    { getName: () => "agent1" } as Agent,
                    { getName: () => "agent2" } as Agent,
                ],
                team: {
                    id: "team123",
                } as Team,
            };

            // This should not throw
            service.logResultInfo(result);
        });
    });

    describe("checkIfAgentsWillRespond", () => {
        it("should return true when agents are present", () => {
            const result = {
                agents: [{ getName: () => "agent1" } as Agent],
            };

            const willRespond = service.checkIfAgentsWillRespond(result);

            expect(willRespond).toBe(true);
        });

        it("should return false when no agents are present", () => {
            const result = {
                agents: [],
            };

            const willRespond = service.checkIfAgentsWillRespond(result);

            expect(willRespond).toBe(false);
        });
    });

    describe("getLLMConfigForEvent", () => {
        it("should return LLM config when available", () => {
            const config = service.getLLMConfigForEvent("default");

            expect(config).toBeDefined();
            expect(config?.provider).toBe("test");
        });

        it("should return undefined when config not found", () => {
            (mockConfigManager.getLLMConfig as any).mockReturnValue(undefined);

            const config = service.getLLMConfigForEvent("nonexistent");

            expect(config).toBeUndefined();
        });

        it("should use default config when no name provided", () => {
            const config = service.getLLMConfigForEvent();

            expect(config).toBeDefined();
            expect(mockConfigManager.getLLMConfig).toHaveBeenCalledWith(undefined);
        });
    });
});
