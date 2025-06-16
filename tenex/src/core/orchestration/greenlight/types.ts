import type { Team } from "@/core/orchestration/types";
import type { Conversation } from "@/utils/agents/Conversation";

export interface ReviewRequest {
    teamId: string;
    conversationId: string;
    taskDescription: string;
    completedWork: WorkSummary;
    timestamp: number;
}

export interface WorkSummary {
    filesModified: string[];
    testsAdded: number;
    testsPassed: number;
    linesOfCode: number;
    keyChanges: string[];
}

export interface ReviewDecision {
    reviewerName: string;
    decision: "approve" | "reject" | "revise";
    feedback: string;
    confidence: number;
    suggestedChanges?: string[];
    timestamp: number;
}

export interface ReviewResult {
    status: "not_required" | "approved" | "rejected" | "revision_needed";
    decisions?: ReviewDecision[];
    aggregatedFeedback?: string;
    requiredChanges?: string[];
    confidence?: number;
}

export interface ReviewCoordinator {
    selectReviewers(team: Team, excludeMembers?: string[]): Promise<string[]>;

    collectReviews(
        reviewers: string[],
        conversation: Conversation,
        reviewRequest: ReviewRequest
    ): Promise<ReviewDecision[]>;
}

export interface ReviewAggregator {
    aggregate(decisions: ReviewDecision[]): ReviewResult;
}
