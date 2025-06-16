import { beforeEach, describe, expect, it, vi } from "vitest";
import { Conversation } from "../../../../utils/agents/Conversation";
import type { Logger } from "../../../../utils/fs";
import type { RequestAnalysis, TaskDefinition, Team } from "../../types";
import { OrchestrationStrategy } from "../../types";
import type { ReviewAggregator } from "../ReviewAggregator";
import type { ReviewCoordinator } from "../ReviewCoordinator";
import { ReviewSystemImpl } from "../ReviewSystem";
import type { ReviewDecision, ReviewRequest, ReviewResult } from "../types";

describe("ReviewSystem", () => {
    let reviewSystem: ReviewSystemImpl;
    let mockCoordinator: ReviewCoordinator;
    let mockAggregator: ReviewAggregator;
    let mockLogger: Logger;

    beforeEach(() => {
        mockCoordinator = {
            selectReviewers: vi.fn(),
            collectReviews: vi.fn(),
        };

        mockAggregator = {
            aggregate: vi.fn(),
        };

        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
        };

        reviewSystem = new ReviewSystemImpl(mockCoordinator, mockAggregator, mockLogger);
    });

    describe("constructor", () => {
        it("should throw if dependencies are not provided", () => {
            expect(
                () =>
                    new ReviewSystemImpl(
                        null as unknown as ReviewCoordinator,
                        mockAggregator,
                        mockLogger
                    )
            ).toThrow("ReviewCoordinator is required");

            expect(
                () =>
                    new ReviewSystemImpl(
                        mockCoordinator,
                        null as unknown as ReviewAggregator,
                        mockLogger
                    )
            ).toThrow("ReviewAggregator is required");

            expect(
                () =>
                    new ReviewSystemImpl(mockCoordinator, mockAggregator, null as unknown as Logger)
            ).toThrow("Logger is required");
        });
    });

    describe("shouldRequireReview", () => {
        it("should respect explicit requiresGreenLight flag", () => {
            const taskWithExplicitTrue: TaskDefinition = {
                description: "Simple bug fix",
                successCriteria: [],
                requiresGreenLight: true,
                estimatedComplexity: 2,
            };

            const taskWithExplicitFalse: TaskDefinition = {
                description: "Major refactor",
                successCriteria: [],
                requiresGreenLight: false,
                estimatedComplexity: 9,
            };

            expect(reviewSystem.shouldRequireReview(taskWithExplicitTrue)).toBe(true);
            expect(reviewSystem.shouldRequireReview(taskWithExplicitFalse)).toBe(false);
        });

        it("should require review for default task types", () => {
            const featureTask: TaskDefinition = {
                description: "Implement new feature for user authentication",
                successCriteria: [],
                estimatedComplexity: 5,
            };

            const refactorTask: TaskDefinition = {
                description: "Refactor the authentication module",
                successCriteria: [],
                estimatedComplexity: 4,
            };

            const securityTask: TaskDefinition = {
                description: "Fix security vulnerability in login",
                successCriteria: [],
                estimatedComplexity: 3,
            };

            expect(reviewSystem.shouldRequireReview(featureTask)).toBe(true);
            expect(reviewSystem.shouldRequireReview(refactorTask)).toBe(true);
            expect(reviewSystem.shouldRequireReview(securityTask)).toBe(true);
        });

        it("should require review for high complexity tasks", () => {
            const highComplexityTask: TaskDefinition = {
                description: "Update dependencies",
                successCriteria: [],
                estimatedComplexity: 8,
            };

            const lowComplexityTask: TaskDefinition = {
                description: "Update dependencies",
                successCriteria: [],
                estimatedComplexity: 3,
            };

            expect(reviewSystem.shouldRequireReview(highComplexityTask)).toBe(true);
            expect(reviewSystem.shouldRequireReview(lowComplexityTask)).toBe(false);
        });

        it("should not require review for general low complexity tasks", () => {
            const simpleTask: TaskDefinition = {
                description: "Update README file",
                successCriteria: [],
                estimatedComplexity: 1,
            };

            expect(reviewSystem.shouldRequireReview(simpleTask)).toBe(false);
        });
    });

    describe("initiateReview", () => {
        it("should return not_required if no task definition", async () => {
            const team: Team = {
                id: "team-123",
                conversationId: "conv-123",
                lead: "lead-agent",
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
                // No taskDefinition
            };

            const conversation = new Conversation("conv-123", "test-agent");

            const result = await reviewSystem.initiateReview(team, conversation);

            expect(result.status).toBe("not_required");
            expect(mockLogger.warn).toHaveBeenCalledWith("No task definition found for team");
        });

        it("should return not_required if task doesn't require review", async () => {
            const team: Team = {
                id: "team-123",
                conversationId: "conv-123",
                lead: "lead-agent",
                members: ["agent1", "agent2"],
                strategy: "HIERARCHICAL",
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
                taskDefinition: {
                    description: "Update comments",
                    successCriteria: [],
                    requiresGreenLight: false,
                    estimatedComplexity: 1,
                },
            };

            const conversation = new Conversation("conv-123", "test-agent");

            const result = await reviewSystem.initiateReview(team, conversation);

            expect(result.status).toBe("not_required");
            expect(mockCoordinator.selectReviewers).not.toHaveBeenCalled();
        });

        it("should return not_required if no reviewers available", async () => {
            const team: Team = {
                id: "team-123",
                conversationId: "conv-123",
                lead: "lead-agent",
                members: ["agent1", "agent2"],
                strategy: "HIERARCHICAL",
                formation: {
                    timestamp: Date.now(),
                    reasoning: "Complex feature",
                    requestAnalysis: {
                        requestType: "feature",
                        requiredCapabilities: ["frontend", "backend"],
                        estimatedComplexity: 8,
                        suggestedStrategy: OrchestrationStrategy.PARALLEL_EXECUTION,
                        reasoning: "Complex task requiring multiple agents",
                    } as RequestAnalysis,
                },
                taskDefinition: {
                    description: "Implement new feature",
                    successCriteria: ["Works correctly"],
                    estimatedComplexity: 7,
                },
            };

            const conversation = new Conversation("conv-123", "test-agent");

            mockCoordinator.selectReviewers.mockResolvedValueOnce([]);

            const result = await reviewSystem.initiateReview(team, conversation);

            expect(result.status).toBe("not_required");
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "No reviewers available, proceeding without review"
            );
        });

        it("should complete full review flow", async () => {
            const team: Team = {
                id: "team-123",
                conversationId: "conv-123",
                lead: "lead-agent",
                members: ["agent1", "agent2"],
                strategy: "HIERARCHICAL",
                formation: {
                    timestamp: Date.now(),
                    reasoning: "Complex feature",
                    requestAnalysis: {
                        requestType: "feature",
                        requiredCapabilities: ["frontend", "backend"],
                        estimatedComplexity: 8,
                        suggestedStrategy: OrchestrationStrategy.PARALLEL_EXECUTION,
                        reasoning: "Complex task requiring multiple agents",
                    } as RequestAnalysis,
                },
                taskDefinition: {
                    description: "Implement authentication feature",
                    successCriteria: ["Secure", "Tested"],
                    estimatedComplexity: 8,
                },
            };

            const conversation = new Conversation("conv-123", "test-agent");

            // Add some mock messages to conversation
            conversation.addMessage({
                role: "assistant",
                content:
                    "I'll implement JWT authentication\n```typescript\nfunction authenticate() {}\n```",
                timestamp: Date.now(),
            });

            const reviewers = ["reviewer1", "reviewer2"];
            const decisions: ReviewDecision[] = [
                {
                    reviewerName: "reviewer1",
                    decision: "approve",
                    feedback: "Good implementation",
                    confidence: 0.9,
                    timestamp: Date.now(),
                },
                {
                    reviewerName: "reviewer2",
                    decision: "approve",
                    feedback: "Well tested",
                    confidence: 0.85,
                    timestamp: Date.now(),
                },
            ];

            const aggregatedResult: ReviewResult = {
                status: "approved",
                decisions,
                aggregatedFeedback: "All reviewers approved",
                confidence: 0.875,
            };

            mockCoordinator.selectReviewers.mockResolvedValueOnce(reviewers);
            mockCoordinator.collectReviews.mockResolvedValueOnce(decisions);
            mockAggregator.aggregate.mockReturnValueOnce(aggregatedResult);

            const result = await reviewSystem.initiateReview(team, conversation);

            expect(result).toEqual(aggregatedResult);
            expect(mockCoordinator.selectReviewers).toHaveBeenCalledWith(team);
            expect(mockCoordinator.collectReviews).toHaveBeenCalledWith(
                reviewers,
                conversation,
                expect.objectContaining({
                    teamId: "team-123",
                    conversationId: "conv-123",
                    taskDescription: "Implement authentication feature",
                    completedWork: expect.objectContaining({
                        filesModified: expect.any(Array),
                        testsAdded: expect.any(Number),
                        testsPassed: expect.any(Number),
                        linesOfCode: expect.any(Number),
                        keyChanges: expect.any(Array),
                    }),
                })
            );
            expect(mockAggregator.aggregate).toHaveBeenCalledWith(decisions);
        });
    });

    describe("processReviewDecisions", () => {
        it("should delegate to aggregator", () => {
            const decisions = [
                {
                    reviewerName: "reviewer1",
                    decision: "approve",
                    feedback: "Good",
                    confidence: 0.9,
                    timestamp: Date.now(),
                },
            ];

            const expectedResult: ReviewResult = {
                status: "approved",
                decisions,
                confidence: 0.9,
            };

            mockAggregator.aggregate.mockReturnValueOnce(expectedResult);

            const result = reviewSystem.processReviewDecisions(decisions);

            expect(result).toEqual(expectedResult);
            expect(mockAggregator.aggregate).toHaveBeenCalledWith(decisions);
        });
    });

    describe("work summary extraction", () => {
        it("should extract code blocks from messages", async () => {
            const team: Team = {
                id: "team-123",
                conversationId: "conv-123",
                lead: "lead-agent",
                members: ["agent1"],
                strategy: "SINGLE_RESPONDER",
                formation: {
                    timestamp: Date.now(),
                    reasoning: "Feature implementation",
                    requestAnalysis: {
                        requestType: "feature",
                        requiredCapabilities: ["frontend", "backend"],
                        estimatedComplexity: 8,
                        suggestedStrategy: OrchestrationStrategy.PARALLEL_EXECUTION,
                        reasoning: "Complex task requiring multiple agents",
                    } as RequestAnalysis,
                },
                taskDefinition: {
                    description: "Implement feature",
                    successCriteria: [],
                    estimatedComplexity: 7,
                },
            };

            const conversation = new Conversation("conv-123", "test-agent");

            // Add messages with code blocks
            conversation.addMessage({
                role: "assistant",
                content: `I'll implement this feature:
\`\`\`typescript
function newFeature() {
    return "implemented";
}
\`\`\`

And add tests:
\`\`\`typescript
describe('newFeature', () => {
    it('should work', () => {
        expect(newFeature()).toBe('implemented');
    });
});
\`\`\``,
                timestamp: Date.now(),
            });

            mockCoordinator.selectReviewers.mockResolvedValueOnce(["reviewer1"]);
            mockCoordinator.collectReviews.mockResolvedValueOnce([]);
            mockAggregator.aggregate.mockReturnValueOnce({ status: "not_required" });

            await reviewSystem.initiateReview(team, conversation);

            // Check that work summary was extracted
            const reviewRequest = mockCoordinator.collectReviews.mock.calls[0][2];
            expect(reviewRequest.completedWork.linesOfCode).toBeGreaterThan(0);
            expect(reviewRequest.completedWork.testsAdded).toBeGreaterThan(0);
        });

        it("should extract file names from messages", async () => {
            const team: Team = {
                id: "team-123",
                conversationId: "conv-123",
                lead: "lead-agent",
                members: ["agent1"],
                strategy: "SINGLE_RESPONDER",
                formation: {
                    timestamp: Date.now(),
                    reasoning: "Update files",
                    requestAnalysis: {
                        requestType: "feature",
                        requiredCapabilities: ["frontend", "backend"],
                        estimatedComplexity: 8,
                        suggestedStrategy: OrchestrationStrategy.PARALLEL_EXECUTION,
                        reasoning: "Complex task requiring multiple agents",
                    } as RequestAnalysis,
                },
                taskDefinition: {
                    description: "Update multiple files",
                    successCriteria: [],
                    estimatedComplexity: 7,
                },
            };

            const conversation = new Conversation("conv-123", "test-agent");

            conversation.addMessage({
                role: "assistant",
                content: "I've updated auth.ts, login.tsx, and config.json files",
                timestamp: Date.now(),
            });

            mockCoordinator.selectReviewers.mockResolvedValueOnce(["reviewer1"]);
            mockCoordinator.collectReviews.mockResolvedValueOnce([]);
            mockAggregator.aggregate.mockReturnValueOnce({ status: "not_required" });

            await reviewSystem.initiateReview(team, conversation);

            const reviewRequest = mockCoordinator.collectReviews.mock.calls[0][2];
            expect(reviewRequest.completedWork.filesModified).toContain("auth.ts");
            expect(reviewRequest.completedWork.filesModified).toContain("login.tsx");
            expect(reviewRequest.completedWork.filesModified).toContain("config.json");
        });
    });
});
