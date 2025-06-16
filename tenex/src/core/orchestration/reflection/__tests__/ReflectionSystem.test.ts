import type { ConversationMessage } from "@tenex/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LLMProvider } from "../../../../utils/agents/llm/types";
import type { Team } from "../../types";
import { ReflectionSystem } from "../ReflectionSystem";
import type { ReflectionConfig, ReflectionContext } from "../ReflectionSystem";

describe("ReflectionSystem", () => {
    let reflectionSystem: ReflectionSystem;
    let mockLLMProvider: LLMProvider;
    let config: ReflectionConfig;
    let mockContext: ReflectionContext;

    beforeEach(() => {
        vi.clearAllMocks();

        mockLLMProvider = {
            generateResponse: vi.fn().mockResolvedValue({
                content: JSON.stringify({
                    lessons: [
                        {
                            type: "mistake",
                            description: "Used wrong API endpoint",
                            context: "During authentication implementation",
                            impact: "medium",
                            tags: ["api", "authentication"],
                        },
                        {
                            type: "success",
                            description: "Effective test coverage strategy",
                            context: "Unit test implementation",
                            impact: "high",
                            tags: ["testing", "quality"],
                        },
                    ],
                    insights: [
                        {
                            observation: "Team communication improved task completion",
                            evidence: ["Clear task delegation", "Quick feedback loops"],
                            confidence: 0.85,
                            applicability: ["collaborative tasks", "complex features"],
                        },
                    ],
                    improvements: [
                        {
                            current: "Manual API endpoint verification",
                            proposed: "Automated API contract testing",
                            rationale: "Reduces errors and speeds up development",
                            priority: "high",
                            effort: "medium",
                        },
                    ],
                }),
                metadata: { model: "test-model" },
            }),
        } as unknown as LLMProvider;

        config = {
            enabled: true,
            autoReflect: true,
            minConfidence: 0.7,
            maxLessonsPerSession: 50,
        };

        const mockTeam: Team = {
            id: "team-123",
            lead: "orchestrator",
            members: ["code", "test"],
            strategy: "collaborative",
            metadata: {},
            formation: {
                reasoning: "Complex task requiring multiple skills",
                confidence: 0.9,
            },
        };

        const mockMessages: ConversationMessage[] = [
            { role: "user", content: "Implement user authentication" },
            { role: "assistant", content: "Starting authentication implementation..." },
            { role: "user", content: "Make sure to handle edge cases" },
            { role: "assistant", content: "Added error handling for invalid tokens" },
        ];

        mockContext = {
            taskId: "task-123",
            taskDescription: "Implement user authentication with JWT",
            team: mockTeam,
            messages: mockMessages,
            outcome: "success",
            metadata: { duration: 3600000 },
        };

        reflectionSystem = new ReflectionSystem(config, mockLLMProvider);
    });

    describe("startReflection", () => {
        it("should create a reflection session with analysis", async () => {
            const session = await reflectionSystem.startReflection(mockContext);

            expect(session).toBeDefined();
            expect(session.taskId).toBe("task-123");
            expect(session.taskDescription).toBe("Implement user authentication with JWT");
            expect(session.outcome).toBe("success");
            expect(session.lessons).toHaveLength(2);
            expect(session.insights).toHaveLength(1);
            expect(session.improvements).toHaveLength(1);
            expect(session.endTime).toBeDefined();
        });

        it("should handle LLM analysis errors gracefully", async () => {
            (mockLLMProvider.generateResponse as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                content: "Invalid JSON response",
                metadata: { model: "test-model" },
            });

            const session = await reflectionSystem.startReflection(mockContext);

            expect(session).toBeDefined();
            expect(session.lessons).toHaveLength(0);
            expect(session.insights).toHaveLength(0);
            expect(session.improvements).toHaveLength(0);
        });

        it("should return empty session when disabled", async () => {
            reflectionSystem = new ReflectionSystem({ enabled: false }, mockLLMProvider);

            const session = await reflectionSystem.startReflection(mockContext);

            expect(session.lessons).toHaveLength(0);
            expect(session.insights).toHaveLength(0);
            expect(session.improvements).toHaveLength(0);
            expect(mockLLMProvider.generateResponse).not.toHaveBeenCalled();
        });

        it("should add lessons to history", async () => {
            await reflectionSystem.startReflection(mockContext);

            const lessons = reflectionSystem.searchLessons({});
            expect(lessons).toHaveLength(2);
        });
    });

    describe("getLessons", () => {
        it("should retrieve lessons from a specific session", async () => {
            const session = await reflectionSystem.startReflection(mockContext);
            const lessons = reflectionSystem.getLessons(session.id);

            expect(lessons).toHaveLength(2);
            expect(lessons[0].type).toBe("mistake");
            expect(lessons[1].type).toBe("success");
        });

        it("should return empty array for non-existent session", () => {
            const lessons = reflectionSystem.getLessons("non-existent");
            expect(lessons).toEqual([]);
        });
    });

    describe("searchLessons", () => {
        beforeEach(async () => {
            // Create multiple sessions with different lessons
            await reflectionSystem.startReflection(mockContext);

            // Add another session with different lesson types
            (mockLLMProvider.generateResponse as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                content: JSON.stringify({
                    lessons: [
                        {
                            type: "discovery",
                            description: "New optimization technique",
                            context: "Performance testing",
                            impact: "high",
                            tags: ["performance", "optimization"],
                        },
                        {
                            type: "optimization",
                            description: "Caching strategy improved response time",
                            context: "API optimization",
                            impact: "high",
                            tags: ["performance", "caching"],
                        },
                    ],
                    insights: [],
                    improvements: [],
                }),
                metadata: { model: "test-model" },
            });

            await reflectionSystem.startReflection({
                ...mockContext,
                taskId: "task-456",
                outcome: "success",
            });
        });

        it("should filter lessons by type", () => {
            const mistakes = reflectionSystem.searchLessons({ type: "mistake" });
            expect(mistakes).toHaveLength(1);
            expect(mistakes[0].type).toBe("mistake");

            const discoveries = reflectionSystem.searchLessons({ type: "discovery" });
            expect(discoveries).toHaveLength(1);
            expect(discoveries[0].type).toBe("discovery");
        });

        it("should filter lessons by impact", () => {
            const highImpact = reflectionSystem.searchLessons({ impact: "high" });
            expect(highImpact).toHaveLength(3); // 1 success + 2 from second session
            expect(highImpact.every((l) => l.impact === "high")).toBe(true);
        });

        it("should filter lessons by tags", () => {
            const performanceLessons = reflectionSystem.searchLessons({
                tags: ["performance"],
            });
            expect(performanceLessons).toHaveLength(2);
            expect(performanceLessons.every((l) => l.tags.includes("performance"))).toBe(true);
        });

        it("should limit results", () => {
            const limited = reflectionSystem.searchLessons({ limit: 2 });
            expect(limited).toHaveLength(2);
        });

        it("should combine filters", () => {
            const filtered = reflectionSystem.searchLessons({
                type: "optimization",
                impact: "high",
                tags: ["performance"],
            });
            expect(filtered).toHaveLength(1);
            expect(filtered[0].description).toContain("Caching strategy");
        });
    });

    describe("getRecentInsights", () => {
        it("should return insights from recent sessions", async () => {
            await reflectionSystem.startReflection(mockContext);

            const insights = reflectionSystem.getRecentInsights();
            expect(insights).toHaveLength(1);
            expect(insights[0].observation).toContain("Team communication");
        });

        it("should filter by minimum confidence", async () => {
            // Create a fresh ReflectionSystem without setup data
            reflectionSystem = new ReflectionSystem(config, mockLLMProvider);

            (mockLLMProvider.generateResponse as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                content: JSON.stringify({
                    lessons: [],
                    insights: [
                        {
                            observation: "Low confidence observation",
                            evidence: ["Some evidence"],
                            confidence: 0.5,
                            applicability: ["general"],
                        },
                        {
                            observation: "High confidence observation",
                            evidence: ["Strong evidence"],
                            confidence: 0.9,
                            applicability: ["specific"],
                        },
                    ],
                    improvements: [],
                }),
                metadata: { model: "test-model" },
            });

            await reflectionSystem.startReflection({
                ...mockContext,
                taskId: "task-789",
            });

            const insights = reflectionSystem.getRecentInsights();
            // With minConfidence: 0.7, low confidence insight should be filtered out
            // Only the high confidence insight (0.9) should remain
            expect(insights).toHaveLength(1);
            expect(insights[0].confidence).toBe(0.9);
            expect(insights.every((i) => i.confidence >= 0.7)).toBe(true);
        });

        it("should limit results", async () => {
            // Create multiple sessions
            for (let i = 0; i < 5; i++) {
                await reflectionSystem.startReflection({
                    ...mockContext,
                    taskId: `task-${i}`,
                });
            }

            const insights = reflectionSystem.getRecentInsights(3);
            expect(insights.length).toBeLessThanOrEqual(3);
        });
    });

    describe("getImprovements", () => {
        beforeEach(async () => {
            await reflectionSystem.startReflection(mockContext);

            // Add session with different priority improvements
            (mockLLMProvider.generateResponse as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                content: JSON.stringify({
                    lessons: [],
                    insights: [],
                    improvements: [
                        {
                            current: "Manual deployment",
                            proposed: "Automated CI/CD pipeline",
                            rationale: "Faster and more reliable deployments",
                            priority: "medium",
                            effort: "large",
                        },
                        {
                            current: "No code reviews",
                            proposed: "Mandatory PR reviews",
                            rationale: "Improves code quality",
                            priority: "low",
                            effort: "trivial",
                        },
                    ],
                }),
                metadata: { model: "test-model" },
            });

            await reflectionSystem.startReflection({
                ...mockContext,
                taskId: "task-improvement",
            });
        });

        it("should return all improvements", () => {
            const improvements = reflectionSystem.getImprovements();
            expect(improvements).toHaveLength(3);
        });

        it("should filter improvements by priority", () => {
            const highPriority = reflectionSystem.getImprovements("high");
            expect(highPriority).toHaveLength(1);
            expect(highPriority[0].priority).toBe("high");

            const mediumPriority = reflectionSystem.getImprovements("medium");
            expect(mediumPriority).toHaveLength(1);
            expect(mediumPriority[0].proposed).toContain("CI/CD");
        });
    });

    describe("clearOldSessions", () => {
        it("should remove sessions older than maxAge", async () => {
            const session1 = await reflectionSystem.startReflection(mockContext);

            // Manually set old timestamp
            const oldSession = await reflectionSystem.startReflection({
                ...mockContext,
                taskId: "old-task",
            });

            // Access private property for testing
            const sessions = (reflectionSystem as any).sessions;
            const oldSessionData = sessions.get(oldSession.id);
            if (oldSessionData) {
                oldSessionData.startTime = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
            }

            reflectionSystem.clearOldSessions(24 * 60 * 60 * 1000); // 24 hours

            // First session should remain, old session should be cleared
            expect(reflectionSystem.getLessons(session1.id)).toHaveLength(2);
            expect(reflectionSystem.getLessons(oldSession.id)).toHaveLength(0);
        });
    });

    describe("edge cases", () => {
        it("should handle empty message history", async () => {
            const emptyContext = {
                ...mockContext,
                messages: [],
            };

            const session = await reflectionSystem.startReflection(emptyContext);
            expect(session).toBeDefined();
            expect(session.lessons).toBeDefined();
        });

        it("should handle malformed LLM responses", async () => {
            const malformedResponses = [
                { content: "Not JSON at all", metadata: {} },
                { content: "{invalid json}", metadata: {} },
                { content: JSON.stringify({ wrong: "structure" }), metadata: {} },
                {
                    content: JSON.stringify({
                        lessons: "not an array",
                        insights: null,
                        improvements: undefined,
                    }),
                    metadata: {},
                },
            ];

            for (const response of malformedResponses) {
                (
                    mockLLMProvider.generateResponse as ReturnType<typeof vi.fn>
                ).mockResolvedValueOnce(response as any);

                const session = await reflectionSystem.startReflection(mockContext);
                expect(session.lessons).toEqual([]);
                expect(session.insights).toEqual([]);
                expect(session.improvements).toEqual([]);
            }
        });

        it("should validate lesson data types", async () => {
            (mockLLMProvider.generateResponse as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                content: JSON.stringify({
                    lessons: [
                        {
                            type: "invalid-type", // Invalid type
                            description: "Test",
                            impact: "extreme", // Invalid impact
                        },
                        {
                            // Missing required fields
                            context: "Some context",
                        },
                        {
                            type: "success",
                            description: "Valid lesson",
                            impact: "high",
                            tags: "not-an-array", // Should be array
                        },
                    ],
                }),
                metadata: { model: "test-model" },
            });

            const session = await reflectionSystem.startReflection(mockContext);

            // Should only include valid lessons
            expect(session.lessons.length).toBeGreaterThan(0);
            expect(session.lessons.every((l) => l.description && l.type)).toBe(true);
        });
    });
});
