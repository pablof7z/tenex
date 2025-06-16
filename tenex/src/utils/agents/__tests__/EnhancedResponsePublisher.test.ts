import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectInfo } from "../../../commands/run/ProjectLoader";
import type { StrategyExecutionResult } from "../../../core/orchestration/strategies/OrchestrationStrategy";
import type { Agent } from "../Agent";
import { EnhancedResponsePublisher } from "../EnhancedResponsePublisher";
import type { AgentResponse } from "../types";

describe("EnhancedResponsePublisher", () => {
    let publisher: EnhancedResponsePublisher;
    let mockNDK: any;
    let mockProjectInfo: ProjectInfo;
    let mockAgent: Agent;
    let mockEvent: NDKEvent;

    beforeEach(() => {
        mockNDK = {
            assertSigner: vi.fn(),
            publish: vi.fn(),
            pool: {
                connectedRelays: vi.fn().mockReturnValue([]),
            },
        };

        mockProjectInfo = {
            projectEvent: {
                id: "project123",
                tagValue: () => "test-project",
            },
            title: "Test Project",
        } as ProjectInfo;

        const mockSigner = {
            sign: vi.fn().mockResolvedValue({}),
            user: vi.fn().mockReturnValue({ pubkey: "agentpubkey" }),
        };

        mockAgent = {
            getName: () => "testAgent",
            getPubkey: () => "agentpubkey",
            getSigner: () => mockSigner,
        } as unknown as Agent;

        const mockReplyEvent = {
            kind: 1,
            content: "",
            tags: [],
            sign: vi.fn().mockResolvedValue({}),
            publish: vi.fn().mockResolvedValue({}),
        };

        mockEvent = {
            id: "event123",
            content: "Test message",
            author: { pubkey: "userpubkey" },
            reply: vi.fn().mockReturnValue(mockReplyEvent),
        } as unknown as NDKEvent;

        publisher = new EnhancedResponsePublisher(mockNDK, mockProjectInfo);
    });

    describe("publishTypingIndicator", () => {
        it("should publish typing start indicator", async () => {
            await publisher.publishTypingIndicator(
                mockEvent,
                mockAgent,
                true,
                "Thinking...",
                "System prompt",
                "User prompt"
            );

            expect(mockEvent.reply).toHaveBeenCalled();
        });

        it("should publish typing stop indicator", async () => {
            await publisher.publishTypingIndicator(mockEvent, mockAgent, false);

            expect(mockEvent.reply).toHaveBeenCalled();
        });

        it("should handle missing system/user prompts", async () => {
            await publisher.publishTypingIndicator(mockEvent, mockAgent, true, "Thinking...");

            expect(mockEvent.reply).toHaveBeenCalled();
        });
    });

    describe("publishResponse", () => {
        it("should publish regular response", async () => {
            const response: AgentResponse = {
                content: "Here's my response",
                metadata: { model: "test-model", tokens: 100 },
            };

            await publisher.publishResponse(mockEvent, response, mockAgent, false);

            expect(mockEvent.reply).toHaveBeenCalled();
        });

        it("should publish response with renderInChat data", async () => {
            const response: AgentResponse = {
                content: "Response with render data",
                metadata: { model: "test-model" },
                renderInChat: {
                    type: "agent_discovery",
                    data: { discoveredAgents: ["agent1", "agent2"] },
                },
            };

            await publisher.publishResponse(mockEvent, response, mockAgent, false);

            expect(mockEvent.reply).toHaveBeenCalled();
        });

        it("should handle task events", async () => {
            const response: AgentResponse = {
                content: "Task completed",
                metadata: { model: "test-model" },
            };

            await publisher.publishResponse(mockEvent, response, mockAgent, true);

            expect(mockEvent.reply).toHaveBeenCalled();
        });
    });

    describe("publishStrategyResponses", () => {
        it("should publish responses from successful strategy execution", async () => {
            const strategyResult: StrategyExecutionResult = {
                success: true,
                responses: [
                    {
                        agentName: "agent1",
                        response: "Response from agent1",
                        timestamp: Date.now(),
                    },
                    {
                        agentName: "agent2",
                        response: "Response from agent2",
                        timestamp: Date.now(),
                    },
                ],
                errors: [],
                metadata: {},
            };

            const mockAgents = new Map([
                ["agent1", { ...mockAgent, getName: () => "agent1" } as Agent],
                ["agent2", { ...mockAgent, getName: () => "agent2" } as Agent],
            ]);

            await publisher.publishStrategyResponses(
                strategyResult,
                mockEvent,
                "conv123",
                mockAgents
            );

            // Should be called twice for each agent response
            expect(mockEvent.reply).toHaveBeenCalledTimes(2);
        });

        it("should handle failed strategy execution", async () => {
            const strategyResult: StrategyExecutionResult = {
                success: false,
                responses: [],
                errors: [new Error("Strategy failed")],
                metadata: {},
            };

            const mockAgents = new Map();

            await publisher.publishStrategyResponses(
                strategyResult,
                mockEvent,
                "conv123",
                mockAgents
            );

            // Should not publish any responses
            expect(mockEvent.reply).not.toHaveBeenCalled();
        });

        it("should handle missing agents gracefully", async () => {
            const strategyResult: StrategyExecutionResult = {
                success: true,
                responses: [
                    {
                        agentName: "nonexistentAgent",
                        response: "Response from missing agent",
                        timestamp: Date.now(),
                    },
                ],
                errors: [],
                metadata: {},
            };

            const mockAgents = new Map();

            await publisher.publishStrategyResponses(
                strategyResult,
                mockEvent,
                "conv123",
                mockAgents
            );

            // Should not publish responses for missing agents
            expect(mockEvent.reply).not.toHaveBeenCalled();
        });
    });

    describe("updateProjectInfo", () => {
        it("should update project info", () => {
            const newProjectInfo = {
                projectEvent: {
                    id: "newproject",
                    tagValue: () => "new-project",
                },
                title: "New Project",
            } as ProjectInfo;

            publisher.updateProjectInfo(newProjectInfo);

            expect(publisher).toBeDefined();
        });
    });
});
