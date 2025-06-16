import { NDKEvent } from "@nostr-dev-kit/ndk";
import type { Agent } from "../../../../utils/agents/Agent";
import { Conversation } from "../../../../utils/agents/Conversation";
import type { Logger } from "../../../../utils/fs";
import type { LLMProvider } from "../../types";
import { LessonGeneratorImpl } from "../LessonGenerator";
import type { AgentLesson, ReflectionTrigger } from "../types";

describe("LessonGenerator", () => {
    let lessonGenerator: LessonGeneratorImpl;
    let mockLLMProvider: jest.Mocked<LLMProvider>;
    let mockLogger: jest.Mocked<Logger>;

    beforeEach(() => {
        mockLLMProvider = {
            complete: jest.fn(),
        };

        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        };

        lessonGenerator = new LessonGeneratorImpl(mockLLMProvider, mockLogger);
    });

    describe("constructor", () => {
        it("should throw if LLMProvider is not provided", () => {
            expect(
                () => new LessonGeneratorImpl(null as unknown as LLMProvider, mockLogger)
            ).toThrow("LLMProvider is required");
        });

        it("should throw if Logger is not provided", () => {
            expect(
                () => new LessonGeneratorImpl(mockLLMProvider, null as unknown as Logger)
            ).toThrow("Logger is required");
        });
    });

    describe("generateLessons", () => {
        it("should generate lessons for multiple agents", async () => {
            const trigger: ReflectionTrigger = {
                triggerEvent: new NDKEvent(),
                conversation: new Conversation("conv-123", "test-agent"),
                detectedIssues: [
                    {
                        type: "logic_error",
                        description: "Incorrect API endpoint used",
                        severity: "high",
                    },
                ],
            };

            const mockAgents: jest.Mocked<Agent>[] = [
                {
                    getName: jest.fn().mockReturnValue("agent1"),
                    getRole: jest.fn().mockReturnValue("Frontend Developer"),
                    getCapabilities: jest.fn().mockReturnValue("React, TypeScript"),
                    getMetadata: jest.fn().mockReturnValue({ ndkEventId: "ndk-1" }),
                } as unknown as Agent,
                {
                    getName: jest.fn().mockReturnValue("agent2"),
                    getRole: jest.fn().mockReturnValue("Backend Developer"),
                    getCapabilities: jest.fn().mockReturnValue("Node.js, API Design"),
                    getMetadata: jest.fn().mockReturnValue({ ndkEventId: "ndk-2" }),
                } as unknown as Agent,
            ];

            mockLLMProvider.complete
                .mockResolvedValueOnce({
                    content: JSON.stringify({
                        applicable: true,
                        lesson: "Always verify API endpoints before implementation",
                        confidence: 0.9,
                        context: {
                            errorType: "logic_error",
                            preventionStrategy: "Create API documentation first",
                            relatedCapabilities: ["React"],
                        },
                    }),
                })
                .mockResolvedValueOnce({
                    content: JSON.stringify({
                        applicable: true,
                        lesson: "Ensure API endpoints match frontend expectations",
                        confidence: 0.95,
                        context: {
                            errorType: "logic_error",
                            preventionStrategy: "Use shared API types",
                            relatedCapabilities: ["API Design"],
                        },
                    }),
                });

            const lessons = await lessonGenerator.generateLessons(trigger, mockAgents);

            expect(lessons).toHaveLength(2);
            expect(lessons[0]).toMatchObject({
                agentName: "agent1",
                ndkAgentEventId: "ndk-1",
                lesson: "Always verify API endpoints before implementation",
                confidence: 0.9,
            });
            expect(lessons[1]).toMatchObject({
                agentName: "agent2",
                ndkAgentEventId: "ndk-2",
                lesson: "Ensure API endpoints match frontend expectations",
                confidence: 0.95,
            });
        });

        it("should handle agents that don't need lessons", async () => {
            const trigger: ReflectionTrigger = {
                triggerEvent: new NDKEvent(),
                conversation: new Conversation("conv-123", "test-agent"),
                detectedIssues: [
                    {
                        type: "styling_error",
                        description: "CSS issue",
                        severity: "low",
                    },
                ],
            };

            const mockAgent: jest.Mocked<Agent> = {
                getName: jest.fn().mockReturnValue("backend-agent"),
                getRole: jest.fn().mockReturnValue("Backend Developer"),
                getCapabilities: jest.fn().mockReturnValue("Node.js, Databases"),
                getMetadata: jest.fn().mockReturnValue({}),
            } as any;

            mockLLMProvider.complete.mockResolvedValueOnce({
                content: JSON.stringify({
                    applicable: false,
                    lesson: "",
                    confidence: 0,
                    context: {},
                }),
            });

            const lessons = await lessonGenerator.generateLessons(trigger, [mockAgent]);

            expect(lessons).toHaveLength(0);
        });

        it("should handle LLM errors gracefully", async () => {
            const trigger: ReflectionTrigger = {
                triggerEvent: new NDKEvent(),
                conversation: new Conversation("conv-123", "test-agent"),
                detectedIssues: [],
            };

            const mockAgent: jest.Mocked<Agent> = {
                getName: jest.fn().mockReturnValue("agent1"),
                getMetadata: jest.fn().mockReturnValue({}),
            } as any;

            mockLLMProvider.complete.mockRejectedValueOnce(new Error("LLM error"));

            const lessons = await lessonGenerator.generateLessons(trigger, [mockAgent]);

            expect(lessons).toHaveLength(0);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Failed to generate lesson for agent agent1")
            );
        });
    });

    describe("deduplicateLessons", () => {
        it("should return single lesson unchanged", async () => {
            const lessons: AgentLesson[] = [
                {
                    agentName: "agent1",
                    ndkAgentEventId: "ndk-1",
                    lesson: "Test lesson",
                    confidence: 0.9,
                    context: {
                        triggerEventId: "event-1",
                        conversationId: "conv-1",
                        relatedCapabilities: [],
                        timestamp: Date.now(),
                    },
                },
            ];

            const result = await lessonGenerator.deduplicateLessons(lessons);
            expect(result).toEqual(lessons);
            expect(mockLLMProvider.complete).not.toHaveBeenCalled();
        });

        it("should remove duplicate lessons", async () => {
            const lessons: AgentLesson[] = [
                {
                    agentName: "agent1",
                    ndkAgentEventId: "ndk-1",
                    lesson: "Always verify API endpoints",
                    confidence: 0.9,
                    context: {
                        triggerEventId: "event-1",
                        conversationId: "conv-1",
                        relatedCapabilities: [],
                        timestamp: Date.now(),
                    },
                },
                {
                    agentName: "agent2",
                    ndkAgentEventId: "ndk-2",
                    lesson: "Verify API endpoints before use",
                    confidence: 0.85,
                    context: {
                        triggerEventId: "event-1",
                        conversationId: "conv-1",
                        relatedCapabilities: [],
                        timestamp: Date.now(),
                    },
                },
                {
                    agentName: "agent3",
                    ndkAgentEventId: "ndk-3",
                    lesson: "Use TypeScript for type safety",
                    confidence: 0.95,
                    context: {
                        triggerEventId: "event-1",
                        conversationId: "conv-1",
                        relatedCapabilities: [],
                        timestamp: Date.now(),
                    },
                },
            ];

            mockLLMProvider.complete.mockResolvedValueOnce({
                content: JSON.stringify([0, 2]), // Keep first and third
            });

            const result = await lessonGenerator.deduplicateLessons(lessons);

            expect(result).toHaveLength(2);
            expect(result[0].agentName).toBe("agent1");
            expect(result[1].agentName).toBe("agent3");
        });

        it("should handle deduplication errors gracefully", async () => {
            const lessons: AgentLesson[] = [
                {
                    agentName: "agent1",
                    ndkAgentEventId: "ndk-1",
                    lesson: "Test lesson 1",
                    confidence: 0.9,
                    context: {
                        triggerEventId: "event-1",
                        conversationId: "conv-1",
                        relatedCapabilities: [],
                        timestamp: Date.now(),
                    },
                },
                {
                    agentName: "agent2",
                    ndkAgentEventId: "ndk-2",
                    lesson: "Test lesson 2",
                    confidence: 0.85,
                    context: {
                        triggerEventId: "event-1",
                        conversationId: "conv-1",
                        relatedCapabilities: [],
                        timestamp: Date.now(),
                    },
                },
            ];

            mockLLMProvider.complete.mockResolvedValueOnce({
                content: "invalid json",
            });

            const result = await lessonGenerator.deduplicateLessons(lessons);

            expect(result).toEqual(lessons); // Should return all lessons on error
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Failed to parse deduplication response")
            );
        });
    });
});
