import { NDKEvent } from "@nostr-dev-kit/ndk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "../../../../utils/agents/Agent";
import type { ConversationStorage } from "../../../../utils/agents/ConversationStorage";
import type { Logger } from "../../../../utils/fs";
import type { Team } from "../../types";
import { HierarchicalStrategy } from "../HierarchicalStrategy";

describe("HierarchicalStrategy", () => {
    let strategy: HierarchicalStrategy;
    let mockLogger: Logger;
    let mockLeadAgent: Agent;
    let mockMemberAgent1: Agent;
    let mockMemberAgent2: Agent;
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

        mockLeadAgent = {
            name: "lead-agent",
            getName: vi.fn().mockReturnValue("lead-agent"),
            getConfig: vi.fn().mockReturnValue({
                role: "Team Lead",
                name: "lead-agent",
            }),
            getOrCreateConversationWithContext: vi.fn().mockResolvedValue({
                getId: vi.fn().mockReturnValue("test-conversation-id-lead"),
                addUserMessage: vi.fn(),
                addAssistantMessage: vi.fn(),
                getLastActivityTime: vi.fn().mockReturnValue(Date.now()),
            }),
            generateResponse: vi.fn().mockResolvedValue({
                content: "Lead coordination response",
                metadata: {
                    agentName: "lead-agent",
                    subtasks: [
                        { agent: "member1", task: "Task 1" },
                        { agent: "member2", task: "Task 2" },
                    ],
                },
            }),
            saveConversationToStorage: vi.fn().mockResolvedValue(undefined),
        } as unknown as Agent;

        mockMemberAgent1 = {
            name: "member1",
            getName: vi.fn().mockReturnValue("member1"),
            getConfig: vi.fn().mockReturnValue({
                role: "Team Member",
                name: "member1",
            }),
            getOrCreateConversationWithContext: vi.fn().mockResolvedValue({
                getId: vi.fn().mockReturnValue("test-conversation-id-member1"),
                addUserMessage: vi.fn(),
                addAssistantMessage: vi.fn(),
                getLastActivityTime: vi.fn().mockReturnValue(Date.now()),
            }),
            generateResponse: vi.fn().mockResolvedValue({
                content: "Member 1 task completed",
                metadata: { agentName: "member1" },
            }),
            saveConversationToStorage: vi.fn().mockResolvedValue(undefined),
        } as unknown as Agent;

        mockMemberAgent2 = {
            name: "member2",
            getName: vi.fn().mockReturnValue("member2"),
            getConfig: vi.fn().mockReturnValue({
                role: "Team Member",
                name: "member2",
            }),
            getOrCreateConversationWithContext: vi.fn().mockResolvedValue({
                getId: vi.fn().mockReturnValue("test-conversation-id-member2"),
                addUserMessage: vi.fn(),
                addAssistantMessage: vi.fn(),
                getLastActivityTime: vi.fn().mockReturnValue(Date.now()),
            }),
            generateResponse: vi.fn().mockResolvedValue({
                content: "Member 2 task completed",
                metadata: { agentName: "member2" },
            }),
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
            getConversation: vi.fn().mockResolvedValue({
                id: "test-conversation-id",
                messages: [],
            }),
        } as unknown as ConversationStorage;

        mockTeam = {
            lead: "lead-agent",
            members: ["lead-agent", "member1", "member2"],
            strategy: "HIERARCHICAL",
            taskDefinition: {
                id: "test-task",
                description: "Test hierarchical task",
                requirements: ["coordination", "delegation"],
                priority: "HIGH",
            },
            metadata: {},
        };

        mockEvent = new NDKEvent();
        mockEvent.content = "Complex request requiring coordination";
        mockEvent.id = "test-event-id";

        strategy = new HierarchicalStrategy(mockLogger);
    });

    describe("constructor", () => {
        it("should throw error if logger is not provided", () => {
            expect(() => new HierarchicalStrategy(null as unknown as Logger)).toThrow(
                "Logger is required"
            );
        });
    });

    describe("execute", () => {
        it("should successfully execute hierarchical coordination", async () => {
            const agents = new Map([
                ["lead-agent", mockLeadAgent],
                ["member1", mockMemberAgent1],
                ["member2", mockMemberAgent2],
            ]);

            const result = await strategy.execute(
                mockTeam,
                mockEvent,
                agents,
                mockConversationStorage
            );

            expect(result.success).toBe(true);
            expect(result.responses).toHaveLength(4); // Initial analysis + 2 member responses + final review

            // Verify lead agent initial analysis
            expect(result.responses[0].agentName).toBe("lead-agent");
            expect(result.responses[0].response).toContain("Lead coordination");

            // Verify member responses
            expect(result.responses[1].agentName).toBe("member1");
            expect(result.responses[2].agentName).toBe("member2");

            // Verify lead agent final review
            expect(result.responses[3].agentName).toBe("lead-agent");
        });

        it("should fail if lead agent is not found", async () => {
            const agents = new Map([
                ["member1", mockMemberAgent1],
                ["member2", mockMemberAgent2],
            ]);

            const result = await strategy.execute(
                mockTeam,
                mockEvent,
                agents,
                mockConversationStorage
            );

            expect(result.success).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors?.[0].message).toContain("Lead agent lead-agent not found");
        });

        it("should handle delegation to team members", async () => {
            const agents = new Map([
                ["lead-agent", mockLeadAgent],
                ["member1", mockMemberAgent1],
                ["member2", mockMemberAgent2],
            ]);

            await strategy.execute(mockTeam, mockEvent, agents, mockConversationStorage);

            // Verify lead agent was called for analysis and review
            expect(mockLeadAgent.generateResponse).toHaveBeenCalledTimes(2); // Analysis + final review

            // Verify member agents were called
            expect(mockMemberAgent1.generateResponse).toHaveBeenCalled();
            expect(mockMemberAgent2.generateResponse).toHaveBeenCalled();

            // Verify member agents created their own conversations
            expect(mockMemberAgent1.getOrCreateConversationWithContext).toHaveBeenCalled();
            expect(mockMemberAgent2.getOrCreateConversationWithContext).toHaveBeenCalled();
        });

        it("should handle partial team member failures", async () => {
            mockMemberAgent1.generateResponse = vi
                .fn()
                .mockRejectedValue(new Error("Member 1 failed"));

            const agents = new Map([
                ["lead-agent", mockLeadAgent],
                ["member1", mockMemberAgent1],
                ["member2", mockMemberAgent2],
            ]);

            const result = await strategy.execute(
                mockTeam,
                mockEvent,
                agents,
                mockConversationStorage
            );

            // Should still succeed with partial results
            expect(result.success).toBe(true);
            expect(result.responses.length).toBeGreaterThan(0);
            expect(result.metadata?.partialFailures).toBeDefined();
        });

        it("should create and manage conversations properly", async () => {
            const agents = new Map([
                ["lead-agent", mockLeadAgent],
                ["member1", mockMemberAgent1],
                ["member2", mockMemberAgent2],
            ]);

            await strategy.execute(mockTeam, mockEvent, agents, mockConversationStorage);

            // Lead agent creates main conversation
            expect(mockLeadAgent.getOrCreateConversationWithContext).toHaveBeenCalledWith(
                "test-task",
                expect.objectContaining({
                    agentRole: "Team Lead",
                    projectName: "lead-agent",
                    orchestrationMetadata: expect.objectContaining({
                        team: mockTeam,
                        strategy: "HIERARCHICAL",
                    }),
                })
            );

            // Member agents create their own conversations
            expect(mockMemberAgent1.getOrCreateConversationWithContext).toHaveBeenCalled();
            expect(mockMemberAgent2.getOrCreateConversationWithContext).toHaveBeenCalled();

            // Lead agent saves conversation
            expect(mockLeadAgent.saveConversationToStorage).toHaveBeenCalled();
        });

        it("should log execution steps", async () => {
            const agents = new Map([
                ["lead-agent", mockLeadAgent],
                ["member1", mockMemberAgent1],
                ["member2", mockMemberAgent2],
            ]);

            await strategy.execute(mockTeam, mockEvent, agents, mockConversationStorage);

            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("Executing HierarchicalStrategy")
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining("analyzing request")
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Delegating"));
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("completed successfully")
            );
        });
    });

    describe("getName", () => {
        it("should return correct strategy name", () => {
            expect(strategy.getName()).toBe("HierarchicalStrategy");
        });
    });

    describe("getDescription", () => {
        it("should return correct strategy description", () => {
            const description = strategy.getDescription();
            expect(description).toContain("Team lead coordinates");
            expect(description).toContain("delegating");
        });
    });
});
