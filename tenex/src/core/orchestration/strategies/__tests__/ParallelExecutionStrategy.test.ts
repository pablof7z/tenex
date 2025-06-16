import { NDKEvent } from "@nostr-dev-kit/ndk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "../../../../utils/agents/Agent";
import type { ConversationStorage } from "../../../../utils/agents/ConversationStorage";
import type { Logger } from "../../../../utils/fs";
import type { Team } from "../../types";
import { ParallelExecutionStrategy } from "../ParallelExecutionStrategy";

describe("ParallelExecutionStrategy", () => {
    let strategy: ParallelExecutionStrategy;
    let mockLogger: Logger;
    let mockAgent1: Agent;
    let mockAgent2: Agent;
    let mockAgent3: Agent;
    let mockConversationStorage: ConversationStorage;
    let mockTeam: Team;
    let mockEvent: NDKEvent;

    beforeEach(() => {
        mockLogger = {
            log: vi.fn(),
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        } as Logger;

        mockAgent1 = {
            name: "agent1",
            getName: vi.fn().mockReturnValue("agent1"),
            getConfig: vi.fn().mockReturnValue({
                role: "agent1",
                name: "agent1",
            }),
            getOrCreateConversationWithContext: vi.fn().mockResolvedValue({
                getId: vi.fn().mockReturnValue("test-conversation-id-1"),
                addUserMessage: vi.fn(),
                addAssistantMessage: vi.fn(),
                getLastActivityTime: vi.fn().mockReturnValue(Date.now()),
            }),
            generateResponse: vi.fn().mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(
                            () =>
                                resolve({
                                    content: "Agent 1 completed task",
                                    metadata: { agentName: "agent1", duration: 100 },
                                }),
                            100
                        )
                    )
            ),
            saveConversationToStorage: vi.fn().mockResolvedValue(undefined),
        } as unknown as Agent;

        mockAgent2 = {
            name: "agent2",
            getName: vi.fn().mockReturnValue("agent2"),
            getConfig: vi.fn().mockReturnValue({
                role: "agent2",
                name: "agent2",
            }),
            getOrCreateConversationWithContext: vi.fn().mockResolvedValue({
                getId: vi.fn().mockReturnValue("test-conversation-id-2"),
                addUserMessage: vi.fn(),
                addAssistantMessage: vi.fn(),
                getLastActivityTime: vi.fn().mockReturnValue(Date.now()),
            }),
            generateResponse: vi.fn().mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(
                            () =>
                                resolve({
                                    content: "Agent 2 completed task",
                                    metadata: { agentName: "agent2", duration: 50 },
                                }),
                            50
                        )
                    )
            ),
            saveConversationToStorage: vi.fn().mockResolvedValue(undefined),
        } as unknown as Agent;

        mockAgent3 = {
            name: "agent3",
            getName: vi.fn().mockReturnValue("agent3"),
            getConfig: vi.fn().mockReturnValue({
                role: "agent3",
                name: "agent3",
            }),
            getOrCreateConversationWithContext: vi.fn().mockResolvedValue({
                getId: vi.fn().mockReturnValue("test-conversation-id-3"),
                addUserMessage: vi.fn(),
                addAssistantMessage: vi.fn(),
                getLastActivityTime: vi.fn().mockReturnValue(Date.now()),
            }),
            generateResponse: vi.fn().mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(
                            () =>
                                resolve({
                                    content: "Agent 3 completed task",
                                    metadata: { agentName: "agent3", duration: 150 },
                                }),
                            150
                        )
                    )
            ),
            saveConversationToStorage: vi.fn().mockResolvedValue(undefined),
        } as unknown as Agent;

        mockConversationStorage = {
            createConversation: vi.fn().mockResolvedValue({
                id: "test-conversation-id",
                messages: [],
                createdAt: Date.now(),
            }),
            addMessage: vi.fn(),
            updateConversationMetadata: vi.fn(),
        } as unknown as ConversationStorage;

        mockTeam = {
            lead: "agent1",
            members: ["agent1", "agent2", "agent3"],
            strategy: "PARALLEL_EXECUTION",
            taskDefinition: {
                id: "test-parallel-task",
                description: "Task requiring parallel execution",
                requirements: ["speed", "independence"],
                priority: "HIGH",
            },
            metadata: {},
        };

        mockEvent = new NDKEvent();
        mockEvent.content = "Request that can be handled in parallel";
        mockEvent.id = "test-event-id";

        strategy = new ParallelExecutionStrategy(mockLogger);
    });

    describe("constructor", () => {
        it("should throw error if logger is not provided", () => {
            expect(() => new ParallelExecutionStrategy(null as unknown as Logger)).toThrow(
                "Logger is required"
            );
        });
    });

    describe("execute", () => {
        it("should execute all agents in parallel", async () => {
            const agents = new Map([
                ["agent1", mockAgent1],
                ["agent2", mockAgent2],
                ["agent3", mockAgent3],
            ]);

            const startTime = Date.now();
            const result = await strategy.execute(
                mockTeam,
                mockEvent,
                agents,
                mockConversationStorage
            );
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            expect(result.success).toBe(true);
            expect(result.responses).toHaveLength(3);

            // Verify all agents were called
            expect(mockAgent1.generateResponse).toHaveBeenCalledTimes(1);
            expect(mockAgent2.generateResponse).toHaveBeenCalledTimes(1);
            expect(mockAgent3.generateResponse).toHaveBeenCalledTimes(1);

            // Verify parallel execution (should take ~150ms, not 300ms)
            expect(totalTime).toBeLessThan(200);
            expect(totalTime).toBeGreaterThanOrEqual(150);
        });

        it("should handle partial failures without blocking other agents", async () => {
            mockAgent2.generateResponse = vi.fn().mockRejectedValue(new Error("Agent 2 failed"));

            const agents = new Map([
                ["agent1", mockAgent1],
                ["agent2", mockAgent2],
                ["agent3", mockAgent3],
            ]);

            const result = await strategy.execute(
                mockTeam,
                mockEvent,
                agents,
                mockConversationStorage
            );

            expect(result.success).toBe(true);
            expect(result.responses).toHaveLength(2); // Only successful responses
            expect(result.errors).toHaveLength(1);
            expect(result.errors?.[0].message).toContain("Agent 2 failed");
        });

        it("should fail if no agents succeed", async () => {
            mockAgent1.generateResponse = vi.fn().mockRejectedValue(new Error("Agent 1 failed"));
            mockAgent2.generateResponse = vi.fn().mockRejectedValue(new Error("Agent 2 failed"));
            mockAgent3.generateResponse = vi.fn().mockRejectedValue(new Error("Agent 3 failed"));

            const agents = new Map([
                ["agent1", mockAgent1],
                ["agent2", mockAgent2],
                ["agent3", mockAgent3],
            ]);

            const result = await strategy.execute(
                mockTeam,
                mockEvent,
                agents,
                mockConversationStorage
            );

            expect(result.success).toBe(false);
            expect(result.responses).toHaveLength(0);
            expect(result.errors).toHaveLength(3);
        });

        it("should handle missing agents gracefully", async () => {
            const agents = new Map([
                ["agent1", mockAgent1],
                // agent2 missing
                ["agent3", mockAgent3],
            ]);

            const result = await strategy.execute(
                mockTeam,
                mockEvent,
                agents,
                mockConversationStorage
            );

            expect(result.success).toBe(true);
            expect(result.responses).toHaveLength(2);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Agent agent2 not found")
            );
        });

        it("should create conversation and track all messages", async () => {
            const agents = new Map([
                ["agent1", mockAgent1],
                ["agent2", mockAgent2],
                ["agent3", mockAgent3],
            ]);

            await strategy.execute(mockTeam, mockEvent, agents, mockConversationStorage);

            expect(mockAgent1.getOrCreateConversationWithContext).toHaveBeenCalledWith(
                "test-parallel-task",
                expect.objectContaining({
                    agentRole: "agent1",
                    projectName: "agent1",
                    orchestrationMetadata: expect.objectContaining({
                        team: mockTeam,
                        strategy: "PARALLEL_EXECUTION",
                    }),
                })
            );

            // All agents should generate responses
            expect(mockAgent1.generateResponse).toHaveBeenCalled();
            expect(mockAgent2.generateResponse).toHaveBeenCalled();
            expect(mockAgent3.generateResponse).toHaveBeenCalled();
        });

        it("should aggregate results and include timing metadata", async () => {
            const agents = new Map([
                ["agent1", mockAgent1],
                ["agent2", mockAgent2],
                ["agent3", mockAgent3],
            ]);

            const result = await strategy.execute(
                mockTeam,
                mockEvent,
                agents,
                mockConversationStorage
            );

            expect(result.metadata).toBeDefined();
            expect(result.metadata?.conversationId).toBe("test-conversation-id-1");
            expect(result.metadata?.executionTime).toBeGreaterThan(0);
            expect(result.metadata?.parallelExecutions).toHaveLength(3);
            expect(result.metadata?.aggregatedContent).toContain("Agent 1 completed task");
            expect(result.metadata?.aggregatedContent).toContain("Agent 2 completed task");
            expect(result.metadata?.aggregatedContent).toContain("Agent 3 completed task");
        });

        it("should log execution steps", async () => {
            const agents = new Map([
                ["agent1", mockAgent1],
                ["agent2", mockAgent2],
                ["agent3", mockAgent3],
            ]);

            await strategy.execute(mockTeam, mockEvent, agents, mockConversationStorage);

            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("Executing ParallelExecutionStrategy")
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining("Starting parallel execution for 3 agents")
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("completed with 3 successful")
            );
        });
    });

    describe("getName", () => {
        it("should return correct strategy name", () => {
            expect(strategy.getName()).toBe("ParallelExecutionStrategy");
        });
    });

    describe("getDescription", () => {
        it("should return correct strategy description", () => {
            const description = strategy.getDescription();
            expect(description).toContain("agents work simultaneously");
            expect(description).toContain("independent");
        });
    });
});
