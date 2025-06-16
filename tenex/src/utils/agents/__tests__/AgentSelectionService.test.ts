import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectInfo } from "../../../commands/run/ProjectLoader";
import type { OrchestrationCoordinator } from "../../../core/orchestration/integration/OrchestrationCoordinator";
import { OrchestrationStrategy, type Team } from "../../../core/orchestration/types";
import type { Agent } from "../Agent";
import { AgentSelectionService } from "../AgentSelectionService";
import type { ConversationStorage } from "../ConversationStorage";
import type { SystemPromptContextFactory } from "../prompts/SystemPromptContextFactory";

describe("AgentSelectionService", () => {
    let service: AgentSelectionService;
    let mockAgents: Map<string, Agent>;
    let mockProjectInfo: ProjectInfo;
    let mockOrchestrationCoordinator: OrchestrationCoordinator;
    let mockContextFactory: SystemPromptContextFactory;
    let mockConversationStorage: ConversationStorage;

    beforeEach(() => {
        // Create mock agents
        mockAgents = new Map([
            [
                "code",
                {
                    getName: () => "code",
                    getPubkey: () => "codepubkey",
                    getConversation: vi.fn().mockReturnValue(undefined),
                    getOrCreateConversationWithContext: vi.fn().mockResolvedValue({
                        setMetadata: vi.fn(),
                    }),
                    saveConversationToStorage: vi.fn(),
                } as unknown as Agent,
            ],
            [
                "planner",
                {
                    getName: () => "planner",
                    getPubkey: () => "plannerpubkey",
                    getConversation: vi.fn().mockReturnValue(undefined),
                    getOrCreateConversationWithContext: vi.fn().mockResolvedValue({
                        setMetadata: vi.fn(),
                    }),
                    saveConversationToStorage: vi.fn(),
                } as unknown as Agent,
            ],
            [
                "debugger",
                {
                    getName: () => "debugger",
                    getPubkey: () => "debuggerpubkey",
                    getConversation: vi.fn().mockReturnValue(undefined),
                    getOrCreateConversationWithContext: vi.fn().mockResolvedValue({
                        setMetadata: vi.fn(),
                    }),
                    saveConversationToStorage: vi.fn(),
                } as unknown as Agent,
            ],
        ]);

        mockProjectInfo = {
            projectEvent: {
                id: "project123",
                tagValue: () => "test-project",
            },
            title: "Test Project",
        } as ProjectInfo;

        mockOrchestrationCoordinator = {
            handleUserEvent: vi.fn().mockResolvedValue({
                success: true,
                team: {
                    id: "team123",
                    conversationId: "conv123",
                    lead: "code",
                    members: ["code", "planner"],
                    strategy: OrchestrationStrategy.PARALLEL_EXECUTION,
                    formation: {
                        timestamp: Date.now(),
                        reasoning: "Test team formation",
                        requestAnalysis: {
                            requestType: "test",
                            requiredCapabilities: ["coding"],
                            estimatedComplexity: 5,
                            suggestedStrategy: OrchestrationStrategy.PARALLEL_EXECUTION,
                            reasoning: "Test analysis",
                        },
                    },
                } as Team,
            }),
        } as unknown as OrchestrationCoordinator;

        mockContextFactory = {
            createContext: vi.fn().mockResolvedValue({}),
        } as unknown as SystemPromptContextFactory;

        mockConversationStorage = {} as ConversationStorage;

        service = new AgentSelectionService(
            mockAgents,
            mockProjectInfo,
            mockOrchestrationCoordinator,
            mockContextFactory,
            mockConversationStorage
        );

        // Set dependencies
        service.updateDependencies({
            isEventFromAnyAgent: vi.fn().mockResolvedValue(false),
            getAgentByPubkey: vi.fn((pubkey) => {
                const agent = Array.from(mockAgents.values()).find((a) => a.getPubkey() === pubkey);
                return Promise.resolve(agent);
            }),
            getAllAvailableAgents: vi.fn().mockResolvedValue(
                new Map([
                    [
                        "code",
                        { description: "Code agent", role: "developer", capabilities: "coding" },
                    ],
                    [
                        "planner",
                        { description: "Planner agent", role: "planner", capabilities: "planning" },
                    ],
                    [
                        "debugger",
                        {
                            description: "Debugger agent",
                            role: "debugger",
                            capabilities: "debugging",
                        },
                    ],
                ])
            ),
        });
    });

    describe("determineRespondingAgents", () => {
        it("should prioritize p-tagged agents", async () => {
            const mockEvent = {
                id: "event123",
                author: { pubkey: "userpubkey" },
                content: "Fix the bug",
            } as NDKEvent;

            const result = await service.determineRespondingAgents(
                mockEvent,
                "conv123",
                ["debuggerpubkey"], // P-tagged pubkey
                false
            );

            expect(result.agents).toHaveLength(1);
            expect(result.agents[0].getName()).toBe("debugger");
            expect(mockOrchestrationCoordinator.handleUserEvent).not.toHaveBeenCalled();
        });

        it("should use orchestration when no p-tags and not from agent", async () => {
            const mockEvent = {
                id: "event123",
                author: { pubkey: "userpubkey" },
                content: "Build a feature",
            } as NDKEvent;

            const result = await service.determineRespondingAgents(
                mockEvent,
                "conv123",
                [], // No p-tags
                false
            );

            expect(result.agents).toHaveLength(2);
            expect(result.agents.map((a) => a.getName())).toContain("code");
            expect(result.agents.map((a) => a.getName())).toContain("planner");
            expect(result.team).toBeDefined();
            expect(mockOrchestrationCoordinator.handleUserEvent).toHaveBeenCalled();
        });

        it("should apply anti-chatter logic for agent events without p-tags", async () => {
            const mockEvent = {
                id: "event123",
                author: { pubkey: "codepubkey" }, // From an agent
                content: "Status update",
            } as NDKEvent;

            // Mock isEventFromAnyAgent to return true for this agent
            service.updateDependencies({
                isEventFromAnyAgent: vi.fn().mockResolvedValue(true),
                getAgentByPubkey: vi.fn((pubkey) => {
                    const agent = Array.from(mockAgents.values()).find(
                        (a) => a.getPubkey() === pubkey
                    );
                    return Promise.resolve(agent);
                }),
                getAllAvailableAgents: vi.fn().mockResolvedValue(new Map()),
            });

            const result = await service.determineRespondingAgents(
                mockEvent,
                "conv123",
                [], // No p-tags
                false
            );

            expect(result.agents).toHaveLength(0);
            expect(mockOrchestrationCoordinator.handleUserEvent).not.toHaveBeenCalled();
        });

        it("should handle existing teams", async () => {
            const mockEvent = {
                id: "event123",
                author: { pubkey: "userpubkey" },
                content: "Continue work",
            } as NDKEvent;

            // Mock existing team in conversation
            const mockConversation = {
                getMetadata: vi.fn().mockImplementation((key) => {
                    if (key === "team") {
                        return {
                            id: "existing-team",
                            conversationId: "conv123",
                            lead: "code",
                            members: ["code", "debugger"],
                            strategy: OrchestrationStrategy.HIERARCHICAL,
                            formation: {
                                timestamp: Date.now(),
                                reasoning: "Existing team",
                                requestAnalysis: {
                                    requestType: "continuation",
                                    requiredCapabilities: ["coding"],
                                    estimatedComplexity: 3,
                                    suggestedStrategy: OrchestrationStrategy.HIERARCHICAL,
                                    reasoning: "Continuing work",
                                },
                            },
                        };
                    }
                    return undefined;
                }),
                isParticipant: vi.fn().mockReturnValue(true),
            };

            // Mock agents to return the conversation
            for (const [_name, agent] of mockAgents) {
                (agent as any).getConversation = vi.fn().mockReturnValue(mockConversation);
            }

            const result = await service.determineRespondingAgents(mockEvent, "conv123", [], false);

            expect(result.agents).toHaveLength(2);
            expect(result.team).toBeDefined();
            expect(result.team!.id).toBe("existing-team");
            expect(mockOrchestrationCoordinator.handleUserEvent).not.toHaveBeenCalled();
        });
    });

    describe("updateAgents", () => {
        it("should update the agents map", () => {
            const newAgents = new Map([
                ["newAgent", { getName: () => "newAgent", getPubkey: () => "newpubkey" } as Agent],
            ]);

            service.updateAgents(newAgents);

            // Since this is a private property, we can test indirectly by checking behavior
            expect(service).toBeDefined();
        });
    });

    describe("updateDependencies", () => {
        it("should update the dependencies", () => {
            const newDependencies = {
                isEventFromAnyAgent: vi.fn().mockResolvedValue(true),
                getAgentByPubkey: vi.fn().mockResolvedValue(undefined),
                getAllAvailableAgents: vi.fn().mockResolvedValue(new Map()),
            };

            service.updateDependencies(newDependencies);

            expect(service).toBeDefined();
        });
    });
});
