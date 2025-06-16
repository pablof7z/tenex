import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationStorage } from "../../../../utils/agents/ConversationStorage";
import type { Logger } from "../../../../utils/fs";
import { MilestoneTracker } from "../MilestoneTracker";
import type { Milestone } from "../types";

describe("MilestoneTracker", () => {
    let tracker: MilestoneTracker;
    let mockLogger: Logger;
    let mockConversationStorage: ConversationStorage;

    beforeEach(() => {
        mockLogger = {
            log: vi.fn(),
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        } as Logger;

        mockConversationStorage = {
            getConversation: vi.fn(),
            updateConversationMetadata: vi.fn(),
            getAllConversations: vi.fn().mockResolvedValue([]),
        } as unknown as ConversationStorage;

        tracker = new MilestoneTracker(mockLogger, mockConversationStorage);
    });

    describe("constructor", () => {
        it("should throw error if logger is not provided", () => {
            expect(
                () => new MilestoneTracker(null as unknown as Logger, mockConversationStorage)
            ).toThrow("Logger is required");
        });

        it("should throw error if conversationStorage is not provided", () => {
            expect(
                () => new MilestoneTracker(mockLogger, null as unknown as ConversationStorage)
            ).toThrow("ConversationStorage is required");
        });
    });

    describe("recordMilestone", () => {
        it("should record a new milestone successfully", async () => {
            const milestone: Milestone = {
                id: "milestone-1",
                taskId: "task-1",
                conversationId: "conv-1",
                agentName: "agent-1",
                description: "Complete initial analysis",
                status: "pending",
                createdAt: Date.now(),
            };

            const existingMetadata = { milestones: [] };
            mockConversationStorage.getConversation = vi.fn().mockResolvedValue({
                id: "conv-1",
                metadata: existingMetadata,
            });

            await tracker.recordMilestone(milestone);

            expect(mockConversationStorage.updateConversationMetadata).toHaveBeenCalledWith(
                "conv-1",
                {
                    milestones: [milestone],
                }
            );
        });

        it("should append to existing milestones", async () => {
            const existingMilestone: Milestone = {
                id: "milestone-1",
                taskId: "task-1",
                conversationId: "conv-1",
                agentName: "agent-1",
                description: "Initial milestone",
                status: "completed",
                createdAt: Date.now() - 1000,
                completedAt: Date.now() - 500,
            };

            const newMilestone: Milestone = {
                id: "milestone-2",
                taskId: "task-1",
                conversationId: "conv-1",
                agentName: "agent-2",
                description: "Second milestone",
                status: "pending",
                createdAt: Date.now(),
            };

            mockConversationStorage.getConversation = vi.fn().mockResolvedValue({
                id: "conv-1",
                metadata: { milestones: [existingMilestone] },
            });

            await tracker.recordMilestone(newMilestone);

            expect(mockConversationStorage.updateConversationMetadata).toHaveBeenCalledWith(
                "conv-1",
                {
                    milestones: [existingMilestone, newMilestone],
                }
            );
        });

        it("should handle conversation not found", async () => {
            const milestone: Milestone = {
                id: "milestone-1",
                taskId: "task-1",
                conversationId: "conv-1",
                agentName: "agent-1",
                description: "Test milestone",
                status: "pending",
                createdAt: Date.now(),
            };

            mockConversationStorage.getConversation = vi.fn().mockResolvedValue(null);

            await expect(tracker.recordMilestone(milestone)).rejects.toThrow(
                "Conversation conv-1 not found"
            );
        });
    });

    describe("getMilestones", () => {
        it("should retrieve milestones for a specific task", async () => {
            const milestone1: Milestone = {
                id: "m1",
                taskId: "task-1",
                conversationId: "conv-1",
                agentName: "agent-1",
                description: "Milestone 1",
                status: "completed",
                createdAt: Date.now(),
            };

            const milestone2: Milestone = {
                id: "m2",
                taskId: "task-1",
                conversationId: "conv-2",
                agentName: "agent-2",
                description: "Milestone 2",
                status: "pending",
                createdAt: Date.now(),
            };

            const milestone3: Milestone = {
                id: "m3",
                taskId: "task-2",
                conversationId: "conv-3",
                agentName: "agent-3",
                description: "Different task milestone",
                status: "pending",
                createdAt: Date.now(),
            };

            mockConversationStorage.getAllConversations = vi.fn().mockResolvedValue([
                { id: "conv-1", metadata: { milestones: [milestone1] } },
                { id: "conv-2", metadata: { milestones: [milestone2] } },
                { id: "conv-3", metadata: { milestones: [milestone3] } },
            ]);

            const result = await tracker.getMilestones("task-1");

            expect(result).toHaveLength(2);
            expect(result).toContainEqual(milestone1);
            expect(result).toContainEqual(milestone2);
            expect(result).not.toContainEqual(milestone3);
        });

        it("should return empty array if no milestones found", async () => {
            mockConversationStorage.getAllConversations = vi.fn().mockResolvedValue([
                { id: "conv-1", metadata: {} },
                { id: "conv-2", metadata: { milestones: [] } },
            ]);

            const result = await tracker.getMilestones("task-1");

            expect(result).toEqual([]);
        });
    });

    describe("getActiveMilestones", () => {
        it("should retrieve only active milestones", async () => {
            const pendingMilestone: Milestone = {
                id: "m1",
                taskId: "task-1",
                conversationId: "conv-1",
                agentName: "agent-1",
                description: "Pending milestone",
                status: "pending",
                createdAt: Date.now(),
            };

            const inProgressMilestone: Milestone = {
                id: "m2",
                taskId: "task-2",
                conversationId: "conv-2",
                agentName: "agent-2",
                description: "In progress milestone",
                status: "in_progress",
                createdAt: Date.now(),
            };

            const completedMilestone: Milestone = {
                id: "m3",
                taskId: "task-3",
                conversationId: "conv-3",
                agentName: "agent-3",
                description: "Completed milestone",
                status: "completed",
                createdAt: Date.now() - 1000,
                completedAt: Date.now(),
            };

            mockConversationStorage.getAllConversations = vi.fn().mockResolvedValue([
                { id: "conv-1", metadata: { milestones: [pendingMilestone] } },
                { id: "conv-2", metadata: { milestones: [inProgressMilestone] } },
                { id: "conv-3", metadata: { milestones: [completedMilestone] } },
            ]);

            const result = await tracker.getActiveMilestones();

            expect(result).toHaveLength(2);
            expect(result).toContainEqual(pendingMilestone);
            expect(result).toContainEqual(inProgressMilestone);
            expect(result).not.toContainEqual(completedMilestone);
        });
    });

    describe("updateMilestoneStatus", () => {
        it("should update milestone status successfully", async () => {
            const milestone: Milestone = {
                id: "milestone-1",
                taskId: "task-1",
                conversationId: "conv-1",
                agentName: "agent-1",
                description: "Test milestone",
                status: "pending",
                createdAt: Date.now() - 1000,
            };

            mockConversationStorage.getAllConversations = vi
                .fn()
                .mockResolvedValue([{ id: "conv-1", metadata: { milestones: [milestone] } }]);

            mockConversationStorage.getConversation = vi.fn().mockResolvedValue({
                id: "conv-1",
                metadata: { milestones: [milestone] },
            });

            await tracker.updateMilestoneStatus("milestone-1", "completed");

            expect(mockConversationStorage.updateConversationMetadata).toHaveBeenCalledWith(
                "conv-1",
                {
                    milestones: [
                        expect.objectContaining({
                            id: "milestone-1",
                            status: "completed",
                            completedAt: expect.any(Number),
                        }),
                    ],
                }
            );
        });

        it("should throw error if milestone not found", async () => {
            mockConversationStorage.getAllConversations = vi
                .fn()
                .mockResolvedValue([{ id: "conv-1", metadata: { milestones: [] } }]);

            await expect(tracker.updateMilestoneStatus("unknown-id", "completed")).rejects.toThrow(
                "Milestone unknown-id not found"
            );
        });

        it("should log status changes", async () => {
            const milestone: Milestone = {
                id: "milestone-1",
                taskId: "task-1",
                conversationId: "conv-1",
                agentName: "agent-1",
                description: "Test milestone",
                status: "in_progress",
                createdAt: Date.now(),
            };

            mockConversationStorage.getAllConversations = vi
                .fn()
                .mockResolvedValue([{ id: "conv-1", metadata: { milestones: [milestone] } }]);

            mockConversationStorage.getConversation = vi.fn().mockResolvedValue({
                id: "conv-1",
                metadata: { milestones: [milestone] },
            });

            await tracker.updateMilestoneStatus("milestone-1", "completed");

            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining(
                    "Updating milestone milestone-1 status from in_progress to completed"
                )
            );
        });
    });
});
