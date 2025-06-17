import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "../../../../utils/agents/Agent";
import { Conversation } from "../../../../utils/agents/Conversation";
import type { ConversationStorage } from "../../../../utils/agents/ConversationStorage";
import type { Logger } from "../../../../utils/fs";
import type { Team } from "../../types";
import type { CorrectionDetector } from "../CorrectionDetector";
import type { LessonGenerator } from "../LessonGenerator";
import type { LessonPublisher } from "../LessonPublisher";
import { ReflectionSystemImpl } from "../ReflectionSystem";
import type { AgentLesson, CorrectionAnalysis, ReflectionTrigger } from "../types";

describe("ReflectionSystem", () => {
    let reflectionSystem: ReflectionSystemImpl;
    let mockDetector: ReturnType<typeof vi.mocked<CorrectionDetector>>;
    let mockLessonGenerator: ReturnType<typeof vi.mocked<LessonGenerator>>;
    let mockLessonPublisher: ReturnType<typeof vi.mocked<LessonPublisher>>;
    let mockConversationStorage: ReturnType<typeof vi.mocked<ConversationStorage>>;
    let mockLogger: ReturnType<typeof vi.mocked<Logger>>;
    let mockNDK: ReturnType<typeof vi.mocked<NDK>>;

    beforeEach(() => {
        mockDetector = {
            isCorrection: vi.fn(),
        };

        mockLessonGenerator = {
            generateLessons: vi.fn(),
            deduplicateLessons: vi.fn(),
        };

        mockLessonPublisher = {
            publishLessons: vi.fn(),
        };

        mockConversationStorage = {
            saveConversation: vi.fn(),
            loadConversation: vi.fn(),
        } as unknown as ConversationStorage;

        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
        };

        mockNDK = {} as unknown as NDK;

        reflectionSystem = new ReflectionSystemImpl(
            mockDetector,
            mockLessonGenerator,
            mockLessonPublisher,
            mockConversationStorage,
            mockLogger
        );
    });

    describe("constructor", () => {
        it("should throw if dependencies are not provided", () => {
            expect(
                () =>
                    new ReflectionSystemImpl(
                        null as unknown as CorrectionDetector,
                        mockLessonGenerator,
                        mockLessonPublisher,
                        mockConversationStorage,
                        mockLogger
                    )
            ).toThrow("CorrectionDetector is required");

            expect(
                () =>
                    new ReflectionSystemImpl(
                        mockDetector,
                        null as unknown as LessonGenerator,
                        mockLessonPublisher,
                        mockConversationStorage,
                        mockLogger
                    )
            ).toThrow("LessonGenerator is required");

            expect(
                () =>
                    new ReflectionSystemImpl(
                        mockDetector,
                        mockLessonGenerator,
                        null as unknown as LessonPublisher,
                        mockConversationStorage,
                        mockLogger
                    )
            ).toThrow("LessonPublisher is required");

            expect(
                () =>
                    new ReflectionSystemImpl(
                        mockDetector,
                        mockLessonGenerator,
                        mockLessonPublisher,
                        null as unknown as ConversationStorage,
                        mockLogger
                    )
            ).toThrow("ConversationStorage is required");

            expect(
                () =>
                    new ReflectionSystemImpl(
                        mockDetector,
                        mockLessonGenerator,
                        mockLessonPublisher,
                        mockConversationStorage,
                        null as unknown as Logger
                    )
            ).toThrow("Logger is required");
        });
    });

    describe("checkForReflection", () => {
        it("should return null when no correction is detected", async () => {
            const event = new NDKEvent();
            const conversation = new Conversation("conv-123", "test-agent");

            mockDetector.isCorrection.mockResolvedValueOnce(null);

            const result = await reflectionSystem.checkForReflection(event, conversation);

            expect(result).toBeNull();
            expect(mockDetector.isCorrection).toHaveBeenCalledWith(event, conversation);
        });

        it("should return reflection trigger when correction is detected", async () => {
            const event = new NDKEvent();
            event.id = "event-123";
            event.content = "That's wrong, it should be X instead of Y";

            const conversation = new Conversation("conv-123", "test-agent");
            const team: Team = {
                id: "team-123",
                conversationId: "conv-123",
                lead: "lead-agent",
                members: ["agent1", "agent2"],
                strategy: "HIERARCHICAL",
                formation: {
                    timestamp: Date.now(),
                    reasoning: "Complex task",
                    requestAnalysis: {} as any,
                },
            };
            conversation.setMetadata("team", team);

            const correctionAnalysis: CorrectionAnalysis = {
                isCorrection: true,
                correctionType: "user_correction",
                confidence: 0.9,
                issues: [
                    {
                        type: "logic_error",
                        description: "Incorrect implementation",
                        severity: "high",
                    },
                ],
            };

            mockDetector.isCorrection.mockResolvedValueOnce(correctionAnalysis);

            const result = await reflectionSystem.checkForReflection(event, conversation);

            expect(result).toEqual({
                triggerEvent: event,
                conversation,
                team,
                detectedIssues: correctionAnalysis.issues,
            });
        });
    });

    describe("orchestrateReflection", () => {
        it("should handle reflection with team members", async () => {
            const trigger: ReflectionTrigger = {
                triggerEvent: new NDKEvent(),
                conversation: new Conversation("conv-123", "test-agent"),
                team: {
                    id: "team-123",
                    conversationId: "conv-123",
                    lead: "lead-agent",
                    members: ["agent1", "agent2"],
                    strategy: "HIERARCHICAL",
                    formation: {
                        timestamp: Date.now(),
                        reasoning: "Complex task",
                        requestAnalysis: {} as any,
                    },
                },
                detectedIssues: [
                    {
                        type: "logic_error",
                        description: "Wrong API endpoint",
                        severity: "high",
                    },
                ],
            };

            const mockAgents = new Map<string, Agent>([
                ["agent1", { getName: () => "agent1" } as Agent],
                ["agent2", { getName: () => "agent2" } as Agent],
                ["lead-agent", { getName: () => "lead-agent" } as Agent],
            ]);

            const generatedLessons: AgentLesson[] = [
                {
                    agentName: "agent1",
                    ndkAgentEventId: "ndk-1",
                    lesson: "Lesson 1",
                    confidence: 0.9,
                    context: {
                        triggerEventId: trigger.triggerEvent.id,
                        conversationId: "conv-123",
                        relatedCapabilities: [],
                        timestamp: Date.now(),
                    },
                },
                {
                    agentName: "agent2",
                    ndkAgentEventId: "ndk-2",
                    lesson: "Lesson 2",
                    confidence: 0.85,
                    context: {
                        triggerEventId: trigger.triggerEvent.id,
                        conversationId: "conv-123",
                        relatedCapabilities: [],
                        timestamp: Date.now(),
                    },
                },
            ];

            mockLessonGenerator.generateLessons.mockResolvedValueOnce(generatedLessons);
            mockLessonGenerator.deduplicateLessons.mockResolvedValueOnce(generatedLessons);
            mockLessonPublisher.publishLessons.mockResolvedValueOnce(["event-1", "event-2"]);

            const result = await reflectionSystem.orchestrateReflection(
                trigger,
                mockAgents,
                mockNDK
            );

            expect(result.lessonsGenerated).toEqual(generatedLessons);
            expect(result.lessonsPublished).toEqual(["event-1", "event-2"]);
            expect(result.reflectionDuration).toBeGreaterThanOrEqual(0);

            // Verify agents were selected correctly
            expect(mockLessonGenerator.generateLessons).toHaveBeenCalledWith(
                trigger,
                expect.arrayContaining([expect.objectContaining({ getName: expect.any(Function) })])
            );

            // Verify conversation was saved with metadata
            expect(mockConversationStorage.saveConversation).toHaveBeenCalled();
        });

        it("should handle reflection without team using participants", async () => {
            const conversation = new Conversation("conv-123", "test-agent");
            vi.spyOn(conversation, "getParticipants").mockReturnValue(["agent1", "agent3"]);

            const trigger: ReflectionTrigger = {
                triggerEvent: new NDKEvent(),
                conversation,
                detectedIssues: [],
            };

            const mockAgents = new Map<string, Agent>([
                ["agent1", { getName: () => "agent1" } as Agent],
                ["agent2", { getName: () => "agent2" } as Agent],
                ["agent3", { getName: () => "agent3" } as Agent],
            ]);

            const generatedLessons: AgentLesson[] = [
                {
                    agentName: "agent1",
                    ndkAgentEventId: "ndk-1",
                    lesson: "Lesson 1",
                    confidence: 0.9,
                    context: {
                        triggerEventId: trigger.triggerEvent.id,
                        conversationId: "conv-123",
                        relatedCapabilities: [],
                        timestamp: Date.now(),
                    },
                },
            ];

            mockLessonGenerator.generateLessons.mockResolvedValueOnce(generatedLessons);
            mockLessonGenerator.deduplicateLessons.mockResolvedValueOnce(generatedLessons);
            mockLessonPublisher.publishLessons.mockResolvedValueOnce(["event-1"]);

            await reflectionSystem.orchestrateReflection(trigger, mockAgents, mockNDK);

            // Verify only participants were selected
            const selectedAgents = mockLessonGenerator.generateLessons.mock.calls[0][1];
            expect(selectedAgents).toHaveLength(2);
            expect(selectedAgents.map((a) => a.name)).toContain("agent1");
            expect(selectedAgents.map((a) => a.name)).toContain("agent3");
            expect(selectedAgents.map((a) => a.name)).not.toContain("agent2");
        });

        it("should handle case with no agents to reflect", async () => {
            const trigger: ReflectionTrigger = {
                triggerEvent: new NDKEvent(),
                conversation: new Conversation("conv-123", "test-agent"),
                team: {
                    id: "team-123",
                    conversationId: "conv-123",
                    lead: "unknown-agent",
                    members: ["unknown-agent-1", "unknown-agent-2"],
                    strategy: "HIERARCHICAL",
                    formation: {
                        timestamp: Date.now(),
                        reasoning: "Complex task",
                        requestAnalysis: {} as any,
                    },
                },
                detectedIssues: [],
            };

            const mockAgents = new Map<string, Agent>(); // Empty agents map

            const result = await reflectionSystem.orchestrateReflection(
                trigger,
                mockAgents,
                mockNDK
            );

            expect(result.lessonsGenerated).toEqual([]);
            expect(result.lessonsPublished).toEqual([]);
            expect(mockLogger.warn).toHaveBeenCalledWith("No agents selected for reflection");
            expect(mockLessonGenerator.generateLessons).not.toHaveBeenCalled();
        });

        it("should handle case with no lessons generated", async () => {
            const trigger: ReflectionTrigger = {
                triggerEvent: new NDKEvent(),
                conversation: new Conversation("conv-123", "test-agent"),
                detectedIssues: [],
            };

            const mockAgents = new Map<string, Agent>([
                ["agent1", { getName: () => "agent1" } as Agent],
            ]);

            // Mock conversation to return agent1 as participant
            vi.spyOn(trigger.conversation, "getParticipants").mockReturnValue(["agent1"]);

            mockLessonGenerator.generateLessons.mockResolvedValueOnce([]);

            const result = await reflectionSystem.orchestrateReflection(
                trigger,
                mockAgents,
                mockNDK
            );

            expect(result.lessonsGenerated).toEqual([]);
            expect(result.lessonsPublished).toEqual([]);
            expect(mockLogger.info).toHaveBeenCalledWith("No lessons generated from reflection");
            expect(mockLessonPublisher.publishLessons).not.toHaveBeenCalled();
        });

        it("should handle deduplication of lessons", async () => {
            const trigger: ReflectionTrigger = {
                triggerEvent: new NDKEvent(),
                conversation: new Conversation("conv-123", "test-agent"),
                detectedIssues: [],
            };

            const mockAgents = new Map<string, Agent>([
                ["agent1", { getName: () => "agent1" } as Agent],
            ]);

            vi.spyOn(trigger.conversation, "getParticipants").mockReturnValue(["agent1"]);

            const generatedLessons: AgentLesson[] = [
                {
                    agentName: "agent1",
                    ndkAgentEventId: "ndk-1",
                    lesson: "Lesson 1",
                    confidence: 0.9,
                    context: {
                        triggerEventId: trigger.triggerEvent.id,
                        conversationId: "conv-123",
                        relatedCapabilities: [],
                        timestamp: Date.now(),
                    },
                },
                {
                    agentName: "agent1",
                    ndkAgentEventId: "ndk-1",
                    lesson: "Lesson 1 duplicate",
                    confidence: 0.85,
                    context: {
                        triggerEventId: trigger.triggerEvent.id,
                        conversationId: "conv-123",
                        relatedCapabilities: [],
                        timestamp: Date.now(),
                    },
                },
            ];

            const deduplicatedLessons = [generatedLessons[0]]; // Only first lesson

            mockLessonGenerator.generateLessons.mockResolvedValueOnce(generatedLessons);
            mockLessonGenerator.deduplicateLessons.mockResolvedValueOnce(deduplicatedLessons);
            mockLessonPublisher.publishLessons.mockResolvedValueOnce(["event-1"]);

            const result = await reflectionSystem.orchestrateReflection(
                trigger,
                mockAgents,
                mockNDK
            );

            expect(mockLessonGenerator.deduplicateLessons).toHaveBeenCalledWith(generatedLessons);
            expect(result.lessonsGenerated).toEqual(deduplicatedLessons);
            expect(mockLogger.info).toHaveBeenCalledWith("Generated 1 unique lessons from 2 total");
        });
    });
});
