import type {
    ReviewAggregator,
    ReviewDecision,
    ReviewResult,
} from "@/core/orchestration/greenlight/types";
import type { AgentLogger } from "@tenex/shared/logger";

export class ReviewAggregatorImpl implements ReviewAggregator {
    private static readonly APPROVAL_THRESHOLD = 0.7; // 70% must approve
    private static readonly HIGH_CONFIDENCE_THRESHOLD = 0.8;

    constructor(private readonly logger: AgentLogger) {
        if (!logger) throw new Error("Logger is required");
    }

    aggregate(decisions: ReviewDecision[]): ReviewResult {
        if (!decisions || decisions.length === 0) {
            return {
                status: "not_required",
            };
        }

        this.logger.info(`Aggregating ${decisions.length} review decisions`);

        // Count decisions by type
        const decisionCounts = {
            approve: 0,
            reject: 0,
            revise: 0,
        };

        let totalConfidence = 0;
        const allFeedback: string[] = [];
        const allSuggestedChanges: string[] = [];

        for (const decision of decisions) {
            decisionCounts[decision.decision]++;
            totalConfidence += decision.confidence;
            allFeedback.push(`[${decision.reviewerName}]: ${decision.feedback}`);

            if (decision.suggestedChanges) {
                allSuggestedChanges.push(...decision.suggestedChanges);
            }
        }

        const averageConfidence = totalConfidence / decisions.length;
        const approvalPercentage = decisionCounts.approve / decisions.length;

        // Determine overall status
        let status: ReviewResult["status"];
        if (decisionCounts.reject > 0) {
            // Any rejection leads to rejection
            status = "rejected";
        } else if (decisionCounts.revise > 0) {
            // Any revision request leads to revision needed
            status = "revision_needed";
        } else if (approvalPercentage >= ReviewAggregatorImpl.APPROVAL_THRESHOLD) {
            // Sufficient approvals
            status = "approved";
        } else {
            // Not enough approvals
            status = "revision_needed";
        }

        // Aggregate feedback
        const aggregatedFeedback = this.aggregateFeedback(allFeedback, status, decisionCounts);

        // Deduplicate and prioritize suggested changes
        const requiredChanges = this.prioritizeChanges(allSuggestedChanges, decisions, status);

        const result: ReviewResult = {
            status,
            decisions,
            aggregatedFeedback,
            confidence: averageConfidence,
        };

        if (requiredChanges.length > 0) {
            result.requiredChanges = requiredChanges;
        }

        this.logger.info(
            `Review aggregation complete: ${status} with ${averageConfidence.toFixed(2)} confidence`
        );

        return result;
    }

    private aggregateFeedback(
        allFeedback: string[],
        status: ReviewResult["status"],
        decisionCounts: Record<string, number>
    ): string {
        const summary = [`Review Status: ${status.toUpperCase()}`];

        // Add decision breakdown
        summary.push(
            `\nDecisions: ${decisionCounts.approve} approved, ${decisionCounts.revise} requested revisions, ${decisionCounts.reject} rejected`
        );

        // Add feedback summary
        if (status === "approved") {
            summary.push("\nThe reviewers approved the work with the following feedback:");
        } else if (status === "rejected") {
            summary.push("\nThe work was rejected with the following concerns:");
        } else if (status === "revision_needed") {
            summary.push("\nRevisions are needed based on the following feedback:");
        }

        summary.push(`\n${allFeedback.join("\n\n")}`);

        return summary.join("\n");
    }

    private prioritizeChanges(
        allSuggestedChanges: string[],
        decisions: ReviewDecision[],
        status: ReviewResult["status"]
    ): string[] {
        if (status === "approved" || allSuggestedChanges.length === 0) {
            return [];
        }

        // Count occurrences of each suggestion
        const changeCounts = new Map<string, number>();
        for (const change of allSuggestedChanges) {
            const normalizedChange = change.toLowerCase().trim();
            changeCounts.set(normalizedChange, (changeCounts.get(normalizedChange) || 0) + 1);
        }

        // Get unique changes sorted by frequency
        const uniqueChanges = Array.from(new Set(allSuggestedChanges));

        // Sort by frequency (most common first) and by confidence of reviewers who suggested them
        const sortedChanges = uniqueChanges.sort((a, b) => {
            const countA = changeCounts.get(a.toLowerCase().trim()) || 0;
            const countB = changeCounts.get(b.toLowerCase().trim()) || 0;

            if (countA !== countB) {
                return countB - countA; // Higher count first
            }

            // If counts are equal, sort by average confidence of reviewers who suggested this change
            const confidenceA = this.getAverageConfidenceForChange(a, decisions);
            const confidenceB = this.getAverageConfidenceForChange(b, decisions);

            return confidenceB - confidenceA; // Higher confidence first
        });

        // For rejected status, return all changes
        // For revision_needed, prioritize based on frequency and confidence
        if (status === "rejected") {
            return sortedChanges;
        }
        // Return changes suggested by multiple reviewers or high-confidence reviewers
        return sortedChanges.filter((change) => {
            const count = changeCounts.get(change.toLowerCase().trim()) || 0;
            const avgConfidence = this.getAverageConfidenceForChange(change, decisions);
            return count > 1 || avgConfidence >= ReviewAggregatorImpl.HIGH_CONFIDENCE_THRESHOLD;
        });
    }

    private getAverageConfidenceForChange(change: string, decisions: ReviewDecision[]): number {
        const reviewersWithChange = decisions.filter((d) =>
            d.suggestedChanges?.some((c) => c.toLowerCase().trim() === change.toLowerCase().trim())
        );

        if (reviewersWithChange.length === 0) {
            return 0;
        }

        const totalConfidence = reviewersWithChange.reduce((sum, d) => sum + d.confidence, 0);

        return totalConfidence / reviewersWithChange.length;
    }
}
