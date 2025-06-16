import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "../../../../utils/agents/Agent";
import { Conversation } from "../../../../utils/agents/Conversation";
import type { Logger } from "../../../../utils/fs";
import type { LLMProvider, RequestAnalysis, Team } from "../../types";
import { OrchestrationStrategy } from "../../types";
import { ReviewCoordinatorImpl } from "../ReviewCoordinator";
import type { ReviewDecision, ReviewRequest } from "../types";

describe("ReviewCoordinator", () => {
    let reviewCoordinator: ReviewCoordinatorImpl;
    let mockLLMProvider: LLMProvider;
    let mockAgents: Map<string, Agent>;
    let mockLogger: Logger;

    beforeEach(() => {
        mockLLMProvider = {
            complete: vi.fn(),
        };

        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
        };

        mockAgents = new Map([
            ["agent1", { getName: () => "agent1", getRole: () => "Frontend Developer" } as Agent],
            ["agent2", { getName: () => "agent2", getRole: () => "Backend Developer" } as Agent],
            ["agent3", { getName: () => "agent3", getRole: () => "QA Engineer" } as Agent],
            [
                "reviewer1",
                { getName: () => "reviewer1", getRole: () => "Senior Developer" } as Agent,
            ],
            [
                "reviewer2",
                { getName: () => "reviewer2", getRole: () => "Security Expert" } as Agent,
            ],
            [
                "reviewer3",
                { getName: () => "reviewer3", getRole: () => "Performance Engineer" } as Agent,
            ],
        ]);

        reviewCoordinator = new ReviewCoordinatorImpl(mockLLMProvider, mockAgents, mockLogger);
    });

    describe("constructor", () => {
        it("should throw if dependencies are not provided", () => {
            expect(
                () =>
                    new ReviewCoordinatorImpl(
                        null as unknown as LLMProvider,
                        mockAgents,
                        mockLogger
                    )
            ).toThrow("LLMProvider is required");

            expect(
                () =>
                    new ReviewCoordinatorImpl(
                        mockLLMProvider,
                        null as unknown as Map<string, Agent>,
                        mockLogger
                    )
            ).toThrow("Agents map is required");

            expect(
                () =>
                    new ReviewCoordinatorImpl(
                        mockLLMProvider,
                        mockAgents,
                        null as unknown as Logger
                    )
            ).toThrow("Logger is required");
        });
    });

    describe("selectReviewers", () => {
        it("should select reviewers excluding team members", async () => {
            const team: Team = {
                id: "team-123",
                conversationId: "conv-123",
                lead: "agent1",
                members: ["agent1", "agent2"],
                strategy: "HIERARCHICAL",
                formation: {
                    timestamp: Date.now(),
                    reasoning: "Complex task",
                    requestAnalysis: {
                        requestType: "feature",
                        requiredCapabilities: ["frontend", "backend"],
                        estimatedComplexity: 8,
                        suggestedStrategy: OrchestrationStrategy.PARALLEL_EXECUTION,
                        reasoning: "Complex task requiring multiple agents",
                    } as RequestAnalysis,
                },
                taskDefinition: {
                    description: "Implement user authentication",
                    successCriteria: ["Login works", "Secure"],
                    requiresGreenLight: true,
                    estimatedComplexity: 8,
                },
            };

            mockLLMProvider.complete.mockResolvedValueOnce({
                content: JSON.stringify(["reviewer1", "reviewer2"]),
            });

            const reviewers = await reviewCoordinator.selectReviewers(team);

            expect(reviewers).toEqual(["reviewer1", "reviewer2"]);
            expect(mockLLMProvider.complete).toHaveBeenCalledWith(
                expect.stringContaining("Select the most appropriate reviewers")
            );

            // Verify team members are excluded
            const prompt = mockLLMProvider.complete.mock.calls[0][0];
            expect(prompt).toContain("reviewer1");
            expect(prompt).toContain("reviewer2");
            expect(prompt).toContain("reviewer3");
            expect(prompt).toContain("agent3");
            expect(prompt).not.toContain("agent1: Frontend");
            expect(prompt).not.toContain("agent2: Backend");
        });

        it("should handle LLM errors with fallback", async () => {
            const team: Team = {
                id: "team-123",
                conversationId: "conv-123",
                lead: "agent1",
                members: ["agent1", "agent2"],
                strategy: "HIERARCHICAL",
                formation: {
                    timestamp: Date.now(),
                    reasoning: "Complex task",
                    requestAnalysis: {
                        requestType: "feature",
                        requiredCapabilities: ["frontend", "backend"],
                        estimatedComplexity: 8,
                        suggestedStrategy: OrchestrationStrategy.PARALLEL_EXECUTION,
                        reasoning: "Complex task requiring multiple agents",
                    } as RequestAnalysis,
                },
            };

            mockLLMProvider.complete.mockResolvedValueOnce({
                content: "invalid json",
            });

            const reviewers = await reviewCoordinator.selectReviewers(team);

            // Should fallback to random selection
            expect(reviewers.length).toBeLessThanOrEqual(3);
            expect(reviewers.every((r) => !team.members.includes(r))).toBe(true);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Failed to parse reviewer selection")
            );
        });

        it("should return empty array when no reviewers available", async () => {
            const team: Team = {
                id: "team-123",
                conversationId: "conv-123",
                lead: "agent1",
                members: ["agent2", "agent3", "reviewer1", "reviewer2", "reviewer3"],
                strategy: "PARALLEL_EXECUTION",
                formation: {
                    timestamp: Date.now(),
                    reasoning: "All hands on deck",
                    requestAnalysis: {
                        requestType: "feature",
                        requiredCapabilities: ["frontend", "backend"],
                        estimatedComplexity: 8,
                        suggestedStrategy: OrchestrationStrategy.PARALLEL_EXECUTION,
                        reasoning: "Complex task requiring multiple agents",
                    } as RequestAnalysis,
                },
            };

            const reviewers = await reviewCoordinator.selectReviewers(team);

            expect(reviewers).toEqual([]);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "No available reviewers found outside the team"
            );
        });

        it("should respect exclude members parameter", async () => {
            const team: Team = {
                id: "team-123",
                conversationId: "conv-123",
                lead: "agent1",
                members: ["agent1"],
                strategy: "SINGLE_RESPONDER",
                formation: {
                    timestamp: Date.now(),
                    reasoning: "Simple task",
                    requestAnalysis: {
                        requestType: "feature",
                        requiredCapabilities: ["frontend", "backend"],
                        estimatedComplexity: 8,
                        suggestedStrategy: OrchestrationStrategy.PARALLEL_EXECUTION,
                        reasoning: "Complex task requiring multiple agents",
                    } as RequestAnalysis,
                },
            };

            mockLLMProvider.complete.mockResolvedValueOnce({
                content: JSON.stringify(["agent3", "reviewer1"]),
            });

            const reviewers = await reviewCoordinator.selectReviewers(team, [
                "agent2",
                "reviewer3",
            ]);

            expect(reviewers).toEqual(["agent3", "reviewer1"]);

            const prompt = mockLLMProvider.complete.mock.calls[0][0];
            expect(prompt).not.toContain("agent2"); // Excluded
            expect(prompt).not.toContain("reviewer3"); // Excluded
        });
    });

    describe("collectReviews", () => {
        it("should collect reviews from multiple reviewers", async () => {
            const reviewers = ["reviewer1", "reviewer2"];
            const conversation = new Conversation("conv-123", "test-agent");
            const reviewRequest: ReviewRequest = {
                teamId: "team-123",
                conversationId: "conv-123",
                taskDescription: "Implement user authentication",
                completedWork: {
                    filesModified: ["auth.ts", "login.tsx"],
                    testsAdded: 5,
                    testsPassed: 5,
                    linesOfCode: 200,
                    keyChanges: ["Added JWT authentication", "Created login form"],
                },
                timestamp: Date.now(),
            };

            mockLLMProvider.complete
                .mockResolvedValueOnce({
                    content: JSON.stringify({
                        decision: "approve",
                        feedback: "Well-implemented authentication system",
                        confidence: 0.9,
                    }),
                })
                .mockResolvedValueOnce({
                    content: JSON.stringify({
                        decision: "revise",
                        feedback: "Security concerns need addressing",
                        confidence: 0.8,
                        suggestedChanges: ["Add rate limiting", "Implement CSRF protection"],
                    }),
                });

            const decisions = await reviewCoordinator.collectReviews(
                reviewers,
                conversation,
                reviewRequest
            );

            expect(decisions).toHaveLength(2);
            expect(decisions[0]).toMatchObject({
                reviewerName: "reviewer1",
                decision: "approve",
                feedback: "Well-implemented authentication system",
                confidence: 0.9,
            });
            expect(decisions[1]).toMatchObject({
                reviewerName: "reviewer2",
                decision: "revise",
                feedback: "Security concerns need addressing",
                confidence: 0.8,
                suggestedChanges: ["Add rate limiting", "Implement CSRF protection"],
            });
        });

        it("should handle reviewer not found", async () => {
            const reviewers = ["non-existent-reviewer"];
            const conversation = new Conversation("conv-123", "test-agent");
            const reviewRequest: ReviewRequest = {
                teamId: "team-123",
                conversationId: "conv-123",
                taskDescription: "Test task",
                completedWork: {
                    filesModified: [],
                    testsAdded: 0,
                    testsPassed: 0,
                    linesOfCode: 0,
                    keyChanges: [],
                },
                timestamp: Date.now(),
            };

            const decisions = await reviewCoordinator.collectReviews(
                reviewers,
                conversation,
                reviewRequest
            );

            expect(decisions).toEqual([]);
            expect(mockLogger.error).toHaveBeenCalledWith(
                "Reviewer agent non-existent-reviewer not found"
            );
        });

        it("should handle review parsing errors", async () => {
            const reviewers = ["reviewer1"];
            const conversation = new Conversation("conv-123", "test-agent");
            const reviewRequest: ReviewRequest = {
                teamId: "team-123",
                conversationId: "conv-123",
                taskDescription: "Test task",
                completedWork: {
                    filesModified: [],
                    testsAdded: 0,
                    testsPassed: 0,
                    linesOfCode: 0,
                    keyChanges: [],
                },
                timestamp: Date.now(),
            };

            mockLLMProvider.complete.mockResolvedValueOnce({
                content: "invalid json",
            });

            const decisions = await reviewCoordinator.collectReviews(
                reviewers,
                conversation,
                reviewRequest
            );

            expect(decisions).toEqual([]);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Failed to collect review from reviewer1")
            );
        });

        it("should return empty array for empty reviewers list", async () => {
            const conversation = new Conversation("conv-123", "test-agent");
            const reviewRequest: ReviewRequest = {
                teamId: "team-123",
                conversationId: "conv-123",
                taskDescription: "Test task",
                completedWork: {
                    filesModified: [],
                    testsAdded: 0,
                    testsPassed: 0,
                    linesOfCode: 0,
                    keyChanges: [],
                },
                timestamp: Date.now(),
            };

            const decisions = await reviewCoordinator.collectReviews(
                [],
                conversation,
                reviewRequest
            );

            expect(decisions).toEqual([]);
            expect(mockLLMProvider.complete).not.toHaveBeenCalled();
        });

        it("should include conversation context in review prompt", async () => {
            const reviewers = ["reviewer1"];
            const conversation = new Conversation("conv-123", "test-agent");

            // Add some messages to conversation
            conversation.addMessage({
                role: "user",
                content: "Implement authentication system",
                timestamp: Date.now(),
            });
            conversation.addMessage({
                role: "assistant",
                content: "I'll implement JWT-based authentication",
                timestamp: Date.now(),
            });

            const reviewRequest: ReviewRequest = {
                teamId: "team-123",
                conversationId: "conv-123",
                taskDescription: "Implement user authentication",
                completedWork: {
                    filesModified: ["auth.ts"],
                    testsAdded: 3,
                    testsPassed: 3,
                    linesOfCode: 150,
                    keyChanges: ["Added JWT authentication"],
                },
                timestamp: Date.now(),
            };

            mockLLMProvider.complete.mockResolvedValueOnce({
                content: JSON.stringify({
                    decision: "approve",
                    feedback: "Good implementation",
                    confidence: 0.9,
                }),
            });

            await reviewCoordinator.collectReviews(reviewers, conversation, reviewRequest);

            const reviewPrompt = mockLLMProvider.complete.mock.calls[0][0];
            expect(reviewPrompt).toContain("Recent Conversation Context:");
            expect(reviewPrompt).toContain("Implement authentication system");
            expect(reviewPrompt).toContain("JWT-based authentication");
        });
    });
});
