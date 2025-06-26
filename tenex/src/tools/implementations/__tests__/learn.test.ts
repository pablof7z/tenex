import { describe, it, expect, beforeEach, mock } from "bun:test";
import { learnTool } from "../learn";
import type { ToolExecutionContext } from "../../types";
import type { Agent } from "@/agents/types";
import type { Conversation } from "@/conversations/types";
import { NDKAgentLesson } from "@/events/NDKAgentLesson";
import type NDK from "@nostr-dev-kit/ndk";
import type { NDKSigner } from "@nostr-dev-kit/ndk";

// Mock dependencies
mock.module("@/utils/logger", () => ({
    logger: {
        info: mock(),
        warn: mock(),
        error: mock(),
    },
}));

mock.module("@/nostr", () => ({
    getNDK: mock(),
}));

mock.module("@/services/ProjectContext", () => ({
    getProjectContext: mock(),
}));

mock.module("@/events/NDKAgentLesson", () => {
    const mockPublish = mock();
    const mockSign = mock();
    const mockTag = mock();
    
    return {
        NDKAgentLesson: mock((ndk: NDK) => ({
            title: undefined,
            lesson: undefined,
            agent: undefined,
            tags: [],
            id: "mock-lesson-id",
            tag: mockTag,
            sign: mockSign,
            publish: mockPublish,
        })),
    };
});

import { logger } from "@/utils/logger";
import { getNDK } from "@/nostr";
import { getProjectContext } from "@/services/ProjectContext";
import { getTotalExecutionTimeSeconds } from "@/conversations/executionTime";

describe("Learn Tool", () => {
    let mockContext: ToolExecutionContext;
    let mockNDK: any;
    let mockProjectContext: any;
    let mockSigner: NDKSigner;
    let mockLesson: any;

    beforeEach(() => {
        // Reset all mocks
        mock.restore();
        
        mockSigner = {
            sign: mock(),
            user: async () => ({ pubkey: "agent-pubkey" }),
        } as any;

        mockNDK = {
            signer: mockSigner,
        };

        mockProjectContext = {
            project: {
                tagId: () => "project-123",
            },
            getLessonsForAgent: mock(() => []),
            getAllLessons: mock(() => []),
        };

        mockContext = {
            agent: {
                name: "dev-senior",
                pubkey: "agent-pubkey-123",
                eventId: "agent-event-id",
            } as Agent,
            agentName: "dev-senior",
            agentSigner: mockSigner,
            phase: "building",
            conversationId: "conv-123",
            conversation: {
                executionTime: {
                    totalSeconds: 42,
                    isActive: false,
                },
            } as Conversation,
        };

        // Setup mocks
        (getNDK as any).mockReturnValue(mockNDK);
        (getProjectContext as any).mockReturnValue(mockProjectContext);
        
        // Create a fresh mock lesson for each test
        mockLesson = {
            title: undefined,
            lesson: undefined,
            agent: undefined,
            tags: [],
            id: "mock-lesson-id",
            tag: mock(),
            sign: mock().mockResolvedValue(undefined),
            publish: mock().mockResolvedValue(undefined),
        };
        
        (NDKAgentLesson as any).mockImplementation(() => mockLesson);
    });

    describe("Parameter Validation", () => {
        it("should validate required fields", async () => {
            const result = await learnTool.execute({}, mockContext);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain("Required");
        });

        it("should require title field", async () => {
            const result = await learnTool.execute({
                lesson: "Test lesson content",
            }, mockContext);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain("Required");
        });

        it("should require lesson field", async () => {
            const result = await learnTool.execute({
                title: "Test Title",
            }, mockContext);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain("Required");
        });

        it("should accept valid parameters", async () => {
            const params = {
                title: "Async TypeScript Best Practices",
                lesson: "Always use async/await instead of callbacks for better error handling",
                keywords: ["typescript", "async", "promises"],
            };

            const result = await learnTool.execute(params, mockContext);
            
            expect(result.success).toBe(true);
            expect(logger.info).toHaveBeenCalledWith(
                "🎓 Agent recording new lesson",
                expect.objectContaining({
                    agent: "dev-senior",
                    title: "Async TypeScript Best Practices",
                })
            );
        });

        it("should handle keywords as optional", async () => {
            const params = {
                title: "Git Rebase Strategy",
                lesson: "Use interactive rebase to clean up commit history before merging",
            };

            const result = await learnTool.execute(params, mockContext);
            
            expect(result.success).toBe(true);
            expect(logger.info).toHaveBeenCalledWith(
                "🎓 Agent recording new lesson",
                expect.objectContaining({
                    keywordCount: 0,
                    keywords: "none",
                })
            );
        });

        it("should normalize keywords to lowercase and trim", async () => {
            const params = {
                title: "Test Title",
                lesson: "Test lesson",
                keywords: ["  TypeScript  ", "ASYNC", "promises"],
            };

            await learnTool.execute(params, mockContext);
            
            // Check that tags were added with normalized keywords
            const addedTags = mockLesson.tags.filter((tag: string[]) => tag[0] === "t");
            expect(addedTags).toEqual([
                ["t", "typescript"],
                ["t", "async"],
                ["t", "promises"],
            ]);
        });
    });

    describe("Execution Logic", () => {
        it("should handle missing agent signer", async () => {
            mockContext.agentSigner = undefined;
            
            const result = await learnTool.execute({
                title: "Test",
                lesson: "Test lesson",
            }, mockContext);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe("Agent signer not available for publishing lesson");
            expect(logger.warn).toHaveBeenCalled();
        });

        it("should handle missing NDK instance", async () => {
            (getNDK as any).mockReturnValue(null);
            
            const result = await learnTool.execute({
                title: "Test",
                lesson: "Test lesson",
            }, mockContext);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe("NDK instance not available");
            expect(logger.error).toHaveBeenCalled();
        });

        it("should handle event publishing failures", async () => {
            mockLesson.publish.mockRejectedValue(new Error("Network error"));
            
            const result = await learnTool.execute({
                title: "Test",
                lesson: "Test lesson",
            }, mockContext);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe("Network error");
            expect(logger.error).toHaveBeenCalledWith(
                "❌ Learn tool failed",
                expect.objectContaining({
                    error: "Network error",
                })
            );
        });

        it("should successfully create and publish lesson", async () => {
            const params = {
                title: "React Performance Tips",
                lesson: "Use React.memo for expensive components to prevent unnecessary re-renders",
                keywords: ["react", "performance", "optimization"],
            };

            const result = await learnTool.execute(params, mockContext);
            
            expect(result.success).toBe(true);
            expect(result.output).toContain("✅ Lesson recorded");
            expect(result.output).toContain("React Performance Tips");
            expect(result.metadata).toEqual({
                eventId: "mock-lesson-id",
                title: "React Performance Tips",
                lessonLength: params.lesson.length,
            });
        });
    });

    describe("Event Creation", () => {
        it("should create lesson event with correct structure", async () => {
            const params = {
                title: "Test Title",
                lesson: "Test lesson content",
                keywords: ["test", "example"],
            };

            await learnTool.execute(params, mockContext);
            
            expect(mockLesson.title).toBe("Test Title");
            expect(mockLesson.lesson).toBe("Test lesson content");
            expect(mockLesson.agent).toEqual({ id: "agent-event-id" });
        });

        it("should add project tag", async () => {
            await learnTool.execute({
                title: "Test",
                lesson: "Test lesson",
            }, mockContext);
            
            expect(mockLesson.tag).toHaveBeenCalledWith(mockProjectContext.project);
        });

        it("should add phase tag", async () => {
            await learnTool.execute({
                title: "Test",
                lesson: "Test lesson",
            }, mockContext);
            
            const phaseTags = mockLesson.tags.filter((tag: string[]) => tag[0] === "phase");
            expect(phaseTags).toEqual([["phase", "building"]]);
        });

        it("should add execution time tag when conversation available", async () => {
            await learnTool.execute({
                title: "Test",
                lesson: "Test lesson",
            }, mockContext);
            
            const timeTags = mockLesson.tags.filter((tag: string[]) => tag[0] === "net-time");
            expect(timeTags).toEqual([["net-time", "42"]]);
        });

        it("should handle missing conversation for execution time", async () => {
            mockContext.conversation = undefined;
            
            await learnTool.execute({
                title: "Test",
                lesson: "Test lesson",
            }, mockContext);
            
            const timeTags = mockLesson.tags.filter((tag: string[]) => tag[0] === "net-time");
            expect(timeTags).toHaveLength(0);
        });

        it("should sign and publish the event", async () => {
            await learnTool.execute({
                title: "Test",
                lesson: "Test lesson",
            }, mockContext);
            
            expect(mockLesson.sign).toHaveBeenCalledWith(mockSigner);
            expect(mockLesson.publish).toHaveBeenCalled();
        });
    });

    describe("Logging and Metrics", () => {
        it("should log lesson creation with correct metrics", async () => {
            mockProjectContext.getLessonsForAgent.mockReturnValue([1, 2, 3]);
            mockProjectContext.getAllLessons.mockReturnValue([1, 2, 3, 4, 5, 6, 7]);
            
            await learnTool.execute({
                title: "Test Lesson",
                lesson: "Test content with some length",
                keywords: ["test", "example"],
            }, mockContext);
            
            expect(logger.info).toHaveBeenCalledWith(
                "✅ Successfully published agent lesson",
                expect.objectContaining({
                    agent: "dev-senior",
                    agentPubkey: "agent-pubkey-123",
                    eventId: "mock-lesson-id",
                    title: "Test Lesson",
                    keywords: 2,
                    phase: "building",
                    totalLessonsForAgent: 3,
                    totalLessonsInProject: 7,
                })
            );
        });

        it("should include all context in error logging", async () => {
            mockLesson.publish.mockRejectedValue(new Error("Test error"));
            
            await learnTool.execute({
                title: "Failed Lesson",
                lesson: "This will fail",
            }, mockContext);
            
            expect(logger.error).toHaveBeenCalledWith(
                "❌ Learn tool failed",
                expect.objectContaining({
                    error: "Test error",
                    agent: "dev-senior",
                    agentPubkey: "agent-pubkey-123",
                    title: "Failed Lesson",
                    phase: "building",
                    conversationId: "conv-123",
                })
            );
        });
    });

    describe("Edge Cases", () => {
        it("should handle empty keywords array", async () => {
            await learnTool.execute({
                title: "Test",
                lesson: "Test lesson",
                keywords: [],
            }, mockContext);
            
            const keywordTags = mockLesson.tags.filter((tag: string[]) => tag[0] === "t");
            expect(keywordTags).toHaveLength(0);
        });

        it("should filter out empty keywords", async () => {
            await learnTool.execute({
                title: "Test",
                lesson: "Test lesson",
                keywords: ["valid", "", "  ", "another"],
            }, mockContext);
            
            const keywordTags = mockLesson.tags.filter((tag: string[]) => tag[0] === "t");
            expect(keywordTags).toEqual([
                ["t", "valid"],
                ["t", "another"],
            ]);
        });

        it("should handle agent without eventId", async () => {
            mockContext.agent.eventId = undefined;
            
            await learnTool.execute({
                title: "Test",
                lesson: "Test lesson",
            }, mockContext);
            
            expect(mockLesson.agent).toBeUndefined();
        });

        it("should handle very long lesson content", async () => {
            const longLesson = "A".repeat(1000);
            
            const result = await learnTool.execute({
                title: "Long Lesson",
                lesson: longLesson,
            }, mockContext);
            
            expect(result.success).toBe(true);
            expect(result.metadata?.lessonLength).toBe(1000);
        });
    });
});