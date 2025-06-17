import { NDKEvent } from "@nostr-dev-kit/ndk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "../../../../utils/agents/Agent";
import type { ConversationStorage } from "../../../../utils/agents/ConversationStorage";
import type { Logger } from "../../../../utils/fs";
import type { Team } from "../../types";
import { SingleResponderStrategy } from "../SingleResponderStrategy";

describe("SingleResponderStrategy", () => {
    let strategy: SingleResponderStrategy;
    let mockLogger: Logger;
    let mockAgent: Agent;
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

        mockAgent = {
            name: "test-agent",
            getConfig: vi.fn().mockReturnValue({
                role: "test-agent",
                name: "test-agent",
            }),
            getOrCreateConversationWithContext: vi.fn().mockResolvedValue({
                getId: vi.fn().mockReturnValue("test-conversation-id"),
                addUserMessage: vi.fn(),
                addAssistantMessage: vi.fn(),
                getLastActivityTime: vi.fn().mockReturnValue(Date.now()),
            }),
            generateResponse: vi.fn().mockResolvedValue({
                content: "Test response",
                metadata: { agentName: "test-agent" },
            }),
            saveConversationToStorage: vi.fn().mockResolvedValue(undefined),
        } as unknown as Agent;

        mockConversationStorage = {
            createConversation: vi.fn().mockResolvedValue({
                id: "test-conversation-id",
                messages: [],
            }),
            addMessage: vi.fn(),
            updateConversationMetadata: vi.fn(),
        } as unknown as ConversationStorage;

        mockTeam = {
            lead: "test-agent",
            members: ["test-agent"],
            strategy: "SINGLE_RESPONDER",
            taskDefinition: {
                id: "test-task",
                description: "Test task",
                requirements: [],
                priority: "MEDIUM",
            },
            metadata: {},
        };

        mockEvent = new NDKEvent();
        mockEvent.content = "Test request";
        mockEvent.id = "test-event-id";

        strategy = new SingleResponderStrategy(mockLogger);
    });

    describe("constructor", () => {
        it("should throw error if logger is not provided", () => {
            expect(() => new SingleResponderStrategy(null as unknown as Logger)).toThrow(
                "Logger is required"
            );
        });
    });

    describe("execute", () => {
        it("should successfully execute with single agent", async () => {
            const agents = new Map([["test-agent", mockAgent]]);

            const result = await strategy.execute(
                mockTeam,
                mockEvent,
                agents,
                mockConversationStorage
            );

            expect(result.success).toBe(true);
            expect(result.responses).toHaveLength(1);
            expect(result.responses[0].agentName).toBe("test-agent");
            expect(result.responses[0].response).toBe("Test response");
            expect(result.responses[0].timestamp).toBeGreaterThan(0);
        });

        it("should fail if lead agent is not found", async () => {
            const agents = new Map();

            const result = await strategy.execute(
                mockTeam,
                mockEvent,
                agents,
                mockConversationStorage
            );

            expect(result.success).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors?.[0].message).toContain("Lead agent test-agent not found");
        });

        it("should handle agent processing errors", async () => {
            const errorMessage = "Processing failed";
            mockAgent.generateResponse = vi.fn().mockRejectedValue(new Error(errorMessage));
            const agents = new Map([["test-agent", mockAgent]]);

            const result = await strategy.execute(
                mockTeam,
                mockEvent,
                agents,
                mockConversationStorage
            );

            expect(result.success).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors?.[0].message).toContain(errorMessage);
        });

        it("should create and manage conversation", async () => {
            const agents = new Map([["test-agent", mockAgent]]);

            await strategy.execute(mockTeam, mockEvent, agents, mockConversationStorage);

            expect(mockAgent.getOrCreateConversationWithContext).toHaveBeenCalledWith(
                "test-task",
                expect.objectContaining({
                    agentRole: expect.any(String),
                    projectName: expect.any(String),
                    orchestrationMetadata: expect.objectContaining({
                        team: mockTeam,
                        strategy: "SINGLE_RESPONDER",
                    }),
                })
            );

            expect(mockAgent.generateResponse).toHaveBeenCalled();
            expect(mockAgent.saveConversationToStorage).toHaveBeenCalled();
        });

        it("should log execution steps", async () => {
            const agents = new Map([["test-agent", mockAgent]]);

            await strategy.execute(mockTeam, mockEvent, agents, mockConversationStorage);

            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("Executing SingleResponderStrategy")
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining("Agent test-agent processing request")
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("completed successfully")
            );
        });
    });

    describe("getName", () => {
        it("should return correct strategy name", () => {
            expect(strategy.name).toBe("SingleResponderStrategy");
        });
    });

    describe("getDescription", () => {
        it("should return correct strategy description", () => {
            const description = strategy.getDescription();
            expect(description).toContain("single agent");
            expect(description).toContain("handles the entire request");
        });
    });
});
