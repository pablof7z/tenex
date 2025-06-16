import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "../../../../utils/fs";
import { ReviewAggregatorImpl } from "../ReviewAggregator";
import type { ReviewDecision } from "../types";

describe("ReviewAggregator", () => {
    let reviewAggregator: ReviewAggregatorImpl;
    let mockLogger: ReturnType<typeof vi.mocked<Logger>>;

    beforeEach(() => {
        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
        };

        reviewAggregator = new ReviewAggregatorImpl(mockLogger);
    });

    describe("constructor", () => {
        it("should throw if Logger is not provided", () => {
            expect(() => new ReviewAggregatorImpl(null as unknown as Logger)).toThrow(
                "Logger is required"
            );
        });
    });

    describe("aggregate", () => {
        it("should return not_required for empty decisions", () => {
            const result = reviewAggregator.aggregate([]);
            expect(result).toEqual({
                status: "not_required",
            });
        });

        it("should return not_required for null decisions", () => {
            const result = reviewAggregator.aggregate(null as unknown as ReviewDecision[]);
            expect(result).toEqual({
                status: "not_required",
            });
        });

        it("should aggregate all approvals to approved status", () => {
            const decisions: ReviewDecision[] = [
                {
                    reviewerName: "reviewer1",
                    decision: "approve",
                    feedback: "Looks good!",
                    confidence: 0.9,
                    timestamp: Date.now(),
                },
                {
                    reviewerName: "reviewer2",
                    decision: "approve",
                    feedback: "Well implemented",
                    confidence: 0.85,
                    timestamp: Date.now(),
                },
            ];

            const result = reviewAggregator.aggregate(decisions);

            expect(result.status).toBe("approved");
            expect(result.decisions).toEqual(decisions);
            expect(result.confidence).toBeCloseTo(0.875, 5); // Average of 0.9 and 0.85
            expect(result.aggregatedFeedback).toContain("Review Status: APPROVED");
            expect(result.aggregatedFeedback).toContain(
                "2 approved, 0 requested revisions, 0 rejected"
            );
            expect(result.aggregatedFeedback).toContain("[reviewer1]: Looks good!");
            expect(result.aggregatedFeedback).toContain("[reviewer2]: Well implemented");
            expect(result.requiredChanges).toBeUndefined();
        });

        it("should return rejected if any reviewer rejects", () => {
            const decisions: ReviewDecision[] = [
                {
                    reviewerName: "reviewer1",
                    decision: "approve",
                    feedback: "Looks good!",
                    confidence: 0.9,
                    timestamp: Date.now(),
                },
                {
                    reviewerName: "reviewer2",
                    decision: "reject",
                    feedback: "Major security issue",
                    confidence: 0.95,
                    suggestedChanges: ["Fix SQL injection vulnerability"],
                    timestamp: Date.now(),
                },
            ];

            const result = reviewAggregator.aggregate(decisions);

            expect(result.status).toBe("rejected");
            expect(result.requiredChanges).toEqual(["Fix SQL injection vulnerability"]);
        });

        it("should return revision_needed if any reviewer requests revision", () => {
            const decisions: ReviewDecision[] = [
                {
                    reviewerName: "reviewer1",
                    decision: "approve",
                    feedback: "Mostly good",
                    confidence: 0.8,
                    timestamp: Date.now(),
                },
                {
                    reviewerName: "reviewer2",
                    decision: "revise",
                    feedback: "Needs improvements",
                    confidence: 0.7,
                    suggestedChanges: ["Add error handling", "Improve test coverage"],
                    timestamp: Date.now(),
                },
            ];

            const result = reviewAggregator.aggregate(decisions);

            expect(result.status).toBe("revision_needed");
            // Changes from a single reviewer with confidence below 0.8 are filtered out
            expect(result.requiredChanges).toBeUndefined();
        });

        it("should require 70% approval threshold", () => {
            const decisions: ReviewDecision[] = [
                {
                    reviewerName: "reviewer1",
                    decision: "approve",
                    feedback: "Good",
                    confidence: 0.8,
                    timestamp: Date.now(),
                },
                {
                    reviewerName: "reviewer2",
                    decision: "approve",
                    feedback: "OK",
                    confidence: 0.6,
                    timestamp: Date.now(),
                },
                {
                    reviewerName: "reviewer3",
                    decision: "revise",
                    feedback: "Needs work",
                    confidence: 0.7,
                    suggestedChanges: ["Refactor complex method"],
                    timestamp: Date.now(),
                },
                {
                    reviewerName: "reviewer4",
                    decision: "revise",
                    feedback: "Could be better",
                    confidence: 0.65,
                    suggestedChanges: ["Add documentation"],
                    timestamp: Date.now(),
                },
            ];

            const result = reviewAggregator.aggregate(decisions);

            // 2 out of 4 approved = 50%, below 70% threshold
            expect(result.status).toBe("revision_needed");
            expect(result.confidence).toBeCloseTo(0.6875, 5); // Average of all confidences
        });

        it("should deduplicate and prioritize suggested changes", () => {
            const decisions: ReviewDecision[] = [
                {
                    reviewerName: "reviewer1",
                    decision: "revise",
                    feedback: "Security concerns",
                    confidence: 0.9,
                    suggestedChanges: ["Add input validation", "Fix SQL injection"],
                    timestamp: Date.now(),
                },
                {
                    reviewerName: "reviewer2",
                    decision: "revise",
                    feedback: "Security and performance",
                    confidence: 0.85,
                    suggestedChanges: ["Fix SQL injection", "Optimize query"], // SQL injection repeated
                    timestamp: Date.now(),
                },
                {
                    reviewerName: "reviewer3",
                    decision: "revise",
                    feedback: "Minor issues",
                    confidence: 0.6,
                    suggestedChanges: ["Add comments"], // Low confidence
                    timestamp: Date.now(),
                },
            ];

            const result = reviewAggregator.aggregate(decisions);

            expect(result.status).toBe("revision_needed");
            // "Fix SQL injection" should be first (suggested by 2 reviewers)
            // "Add input validation" and "Optimize query" from high-confidence reviewers
            // "Add comments" excluded due to low confidence and single suggestion
            expect(result.requiredChanges).toEqual([
                "Fix SQL injection",
                "Add input validation",
                "Optimize query",
            ]);
        });

        it("should prioritize changes by frequency and confidence", () => {
            const decisions: ReviewDecision[] = [
                {
                    reviewerName: "reviewer1",
                    decision: "revise",
                    feedback: "Issues found",
                    confidence: 0.7,
                    suggestedChanges: ["Add tests", "Fix bug A"],
                    timestamp: Date.now(),
                },
                {
                    reviewerName: "reviewer2",
                    decision: "revise",
                    feedback: "Needs work",
                    confidence: 0.9,
                    suggestedChanges: ["Fix bug B", "Add tests"], // "Add tests" repeated
                    timestamp: Date.now(),
                },
                {
                    reviewerName: "reviewer3",
                    decision: "revise",
                    feedback: "Critical issue",
                    confidence: 0.95,
                    suggestedChanges: ["Fix bug C"],
                    timestamp: Date.now(),
                },
            ];

            const result = reviewAggregator.aggregate(decisions);

            // "Add tests" should be first (suggested by 2 reviewers)
            // Then high-confidence single suggestions
            expect(result.requiredChanges?.[0]).toBe("Add tests");
            expect(result.requiredChanges).toContain("Fix bug C"); // High confidence
            expect(result.requiredChanges).toContain("Fix bug B"); // From high confidence reviewer
        });

        it("should return all changes for rejected status", () => {
            const decisions: ReviewDecision[] = [
                {
                    reviewerName: "reviewer1",
                    decision: "reject",
                    feedback: "Multiple issues",
                    confidence: 0.5, // Low confidence
                    suggestedChanges: ["Minor fix 1", "Minor fix 2"],
                    timestamp: Date.now(),
                },
                {
                    reviewerName: "reviewer2",
                    decision: "approve",
                    feedback: "Actually OK",
                    confidence: 0.9,
                    timestamp: Date.now(),
                },
            ];

            const result = reviewAggregator.aggregate(decisions);

            expect(result.status).toBe("rejected");
            // Even low-confidence changes are included for rejected status
            expect(result.requiredChanges).toEqual(["Minor fix 1", "Minor fix 2"]);
        });

        it("should handle case-insensitive duplicate detection", () => {
            const decisions: ReviewDecision[] = [
                {
                    reviewerName: "reviewer1",
                    decision: "revise",
                    feedback: "Fix issues",
                    confidence: 0.8,
                    suggestedChanges: ["Add Input Validation"],
                    timestamp: Date.now(),
                },
                {
                    reviewerName: "reviewer2",
                    decision: "revise",
                    feedback: "Security",
                    confidence: 0.85,
                    suggestedChanges: ["add input validation", "Fix XSS"],
                    timestamp: Date.now(),
                },
            ];

            const result = reviewAggregator.aggregate(decisions);

            // Should recognize "Add Input Validation" and "add input validation" as duplicates
            const uniqueChanges = new Set(
                result.requiredChanges?.map((c) => c.toLowerCase().trim())
            );
            expect(uniqueChanges.size).toBe(2); // Only 2 unique changes
        });
    });
});
