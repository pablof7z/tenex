import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamFormationAnalyzer } from "../../TeamFormationAnalyzer";
import { TeamOrchestratorImpl } from "../../TeamOrchestrator";
import { TeamFormationError } from "../../errors";
import type { AgentDefinition, LLMProvider, Logger } from "../../types";
import { OrchestrationStrategy } from "../../types";

// Mock factories
function createMockAnalyzer(): ReturnType<typeof vi.mocked<TeamFormationAnalyzer>> {
    return {
        analyzeRequest: vi.fn(),
    };
}

function createMockLLMProvider(): ReturnType<typeof vi.mocked<LLMProvider>> {
    return {
        complete: vi.fn(),
    };
}

function createMockLogger(): ReturnType<typeof vi.mocked<Logger>> {
    return {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    };
}

function createTestEvent(content: string): NDKEvent {
    return {
        content,
        id: "test-event-123",
        kind: 11,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        pubkey: "test-pubkey",
    } as NDKEvent;
}

function createTestAgents(
    agents: Array<{ name: string; role: string }>
): Map<string, AgentDefinition> {
    const map = new Map<string, AgentDefinition>();
    for (const agent of agents) {
        map.set(agent.name, {
            name: agent.name,
            role: agent.role,
            description: `${agent.name} description`,
            instructions: `${agent.name} instructions`,
        });
    }
    return map;
}

describe("TeamOrchestrator", () => {
    let orchestrator: TeamOrchestratorImpl;
    let mockAnalyzer: ReturnType<typeof createMockAnalyzer>;
    let mockLLMProvider: ReturnType<typeof createMockLLMProvider>;
    let mockLogger: ReturnType<typeof createMockLogger>;

    const defaultConfig = {
        orchestrator: {
            llmConfig: "default",
            maxTeamSize: 5,
            strategies: {
                simple: OrchestrationStrategy.SINGLE_RESPONDER,
                moderate: OrchestrationStrategy.HIERARCHICAL,
                complex: OrchestrationStrategy.PHASED_DELIVERY,
            },
        },
        supervision: {
            complexTools: ["claude_code"],
            supervisionTimeout: 60000,
        },
        reflection: {
            enabled: true,
            detectionThreshold: 0.7,
            maxLessonsPerAgent: 100,
        },
        greenLight: {
            defaultRequiredFor: ["feature"],
            reviewTimeout: 300000,
            parallelReviews: true,
        },
    };

    beforeEach(() => {
        mockAnalyzer = createMockAnalyzer();
        mockLLMProvider = createMockLLMProvider();
        mockLogger = createMockLogger();

        orchestrator = new TeamOrchestratorImpl(
            mockAnalyzer,
            mockLLMProvider,
            mockLogger,
            defaultConfig
        );
    });

    describe("analyzeAndFormTeam", () => {
        it("should form a team with appropriate members based on analysis", async () => {
            // Arrange
            const event = createTestEvent("Build a search feature with autocomplete");
            const availableAgents = createTestAgents([
                { name: "frontend-expert", role: "UI/UX specialist" },
                { name: "backend-engineer", role: "API developer" },
                { name: "database-admin", role: "Query optimization" },
            ]);

            mockAnalyzer.analyzeRequest.mockResolvedValue({
                requestType: "feature implementation",
                requiredCapabilities: ["frontend", "backend", "database"],
                estimatedComplexity: 7,
                suggestedStrategy: OrchestrationStrategy.HIERARCHICAL,
                reasoning:
                    "Complex feature requiring frontend UI, backend API, and efficient queries",
            });

            mockLLMProvider.complete.mockResolvedValue({
                content: JSON.stringify({
                    team: {
                        lead: "frontend-expert",
                        members: ["frontend-expert", "backend-engineer", "database-admin"],
                        reasoning: "Frontend lead since user-facing feature",
                    },
                    taskDefinition: {
                        description: "Implement search feature with autocomplete functionality",
                        successCriteria: [
                            "Search returns relevant results",
                            "Autocomplete suggestions appear within 200ms",
                            "Results are paginated",
                        ],
                        requiresGreenLight: true,
                        estimatedComplexity: 7,
                    },
                }),
            });

            // Act
            const team = await orchestrator.analyzeAndFormTeam(event, availableAgents, {
                title: "Test Project",
            });

            // Assert
            expect(team).toMatchObject({
                lead: "frontend-expert",
                members: expect.arrayContaining([
                    "frontend-expert",
                    "backend-engineer",
                    "database-admin",
                ]),
                strategy: OrchestrationStrategy.HIERARCHICAL,
                taskDefinition: expect.objectContaining({
                    description: expect.stringContaining("search feature"),
                    requiresGreenLight: true,
                }),
            });

            expect(mockLogger.info).toHaveBeenCalledWith(
                "Team formed",
                expect.objectContaining({
                    teamSize: 3,
                    lead: "frontend-expert",
                    strategy: "hierarchical",
                })
            );
        });

        it("should throw TeamFormationError when no suitable agents available", async () => {
            // Arrange
            const event = createTestEvent("Implement quantum encryption");
            const availableAgents = createTestAgents([
                { name: "frontend-expert", role: "UI/UX specialist" },
                { name: "backend-engineer", role: "API developer" },
            ]);

            mockAnalyzer.analyzeRequest.mockResolvedValue({
                requestType: "security feature",
                requiredCapabilities: ["quantum-computing", "cryptography"],
                estimatedComplexity: 10,
                suggestedStrategy: OrchestrationStrategy.PHASED_DELIVERY,
                reasoning: "Requires specialized quantum knowledge",
            });

            mockLLMProvider.complete.mockResolvedValue({
                content: JSON.stringify({
                    team: {
                        members: [],
                        reasoning: "No agents with required capabilities",
                    },
                }),
            });

            // Act & Assert
            await expect(
                orchestrator.analyzeAndFormTeam(event, availableAgents, { title: "Test" })
            ).rejects.toThrow(TeamFormationError);

            await expect(
                orchestrator.analyzeAndFormTeam(event, availableAgents, { title: "Test" })
            ).rejects.toThrow("No suitable agents found");
        });

        it("should handle LLM failure gracefully", async () => {
            // Arrange
            const event = createTestEvent("Fix the bug");
            mockAnalyzer.analyzeRequest.mockRejectedValue(new Error("LLM service unavailable"));

            // Act & Assert
            await expect(
                orchestrator.analyzeAndFormTeam(event, new Map(), { title: "Test" })
            ).rejects.toThrow("LLM service unavailable");

            expect(mockLogger.error).toHaveBeenCalledWith(
                "Team formation failed",
                expect.objectContaining({
                    error: "LLM service unavailable",
                })
            );
        });
    });
});
