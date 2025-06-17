import type {
    ReviewAggregator,
    ReviewCoordinator,
    ReviewDecision,
} from "@/core/orchestration/greenlight/types";
import type { ReviewRequest, ReviewResult } from "@/core/orchestration/greenlight/types";
import type { TaskDefinition, Team } from "@/core/orchestration/types";
import type { Conversation } from "@/utils/agents/Conversation";
import type { ConversationMessage } from "@/utils/agents/types";
import type { AgentLogger } from "@tenex/shared/logger";

export interface ReviewSystem {
    shouldRequireReview(task: TaskDefinition): boolean;

    initiateReview(team: Team, conversation: Conversation): Promise<ReviewResult>;

    processReviewDecisions(decisions: ReviewDecision[]): ReviewResult;
}

export class ReviewSystemImpl implements ReviewSystem {
    private static readonly DEFAULT_REVIEW_REQUIRED_TYPES = [
        "feature",
        "refactor",
        "security_fix",
        "database_migration",
        "api_change",
    ];

    constructor(
        private readonly coordinator: ReviewCoordinator,
        private readonly aggregator: ReviewAggregator,
        private readonly logger: AgentLogger
    ) {
        if (!coordinator) throw new Error("ReviewCoordinator is required");
        if (!aggregator) throw new Error("ReviewAggregator is required");
        if (!logger) throw new Error("Logger is required");
    }

    shouldRequireReview(task: TaskDefinition): boolean {
        // If explicitly set, use that
        if (task.requiresGreenLight !== undefined) {
            return task.requiresGreenLight;
        }

        // Check if task type is in the default list
        const taskType = this.extractTaskType(task.description);
        if (ReviewSystemImpl.DEFAULT_REVIEW_REQUIRED_TYPES.includes(taskType)) {
            return true;
        }

        // High complexity tasks require review
        if (task.estimatedComplexity >= 7) {
            return true;
        }

        return false;
    }

    async initiateReview(team: Team, conversation: Conversation): Promise<ReviewResult> {
        if (!team.taskDefinition) {
            this.logger.warning("No task definition found for team");
            return { status: "not_required" };
        }

        if (!this.shouldRequireReview(team.taskDefinition)) {
            this.logger.info("Review not required for this task");
            return { status: "not_required" };
        }

        this.logger.info(
            `Initiating green light review for team ${team.id} task: ${team.taskDefinition.description}`
        );

        // Select reviewers
        const reviewers = await this.coordinator.selectReviewers(team);

        if (reviewers.length === 0) {
            this.logger.warning("No reviewers available, proceeding without review");
            return { status: "not_required" };
        }

        // Build review request
        const reviewRequest = this.buildReviewRequest(team, conversation);

        // Collect reviews
        const decisions = await this.coordinator.collectReviews(
            reviewers,
            conversation,
            reviewRequest
        );

        // Aggregate results
        const result = this.aggregator.aggregate(decisions);

        this.logger.info(`Review complete: ${result.status} with ${decisions.length} reviewers`);

        return result;
    }

    processReviewDecisions(decisions: ReviewDecision[]): ReviewResult {
        return this.aggregator.aggregate(decisions);
    }

    private extractTaskType(description: string): string {
        const lowerDesc = description.toLowerCase();

        // Check for common task type indicators
        if (lowerDesc.includes("feature") || lowerDesc.includes("implement")) {
            return "feature";
        }
        if (lowerDesc.includes("refactor")) {
            return "refactor";
        }
        if (lowerDesc.includes("security") || lowerDesc.includes("vulnerability")) {
            return "security_fix";
        }
        if (lowerDesc.includes("database") || lowerDesc.includes("migration")) {
            return "database_migration";
        }
        if (lowerDesc.includes("api") || lowerDesc.includes("endpoint")) {
            return "api_change";
        }
        if (lowerDesc.includes("bug") || lowerDesc.includes("fix")) {
            return "bug_fix";
        }

        return "general";
    }

    private buildReviewRequest(team: Team, conversation: Conversation): ReviewRequest {
        // Extract work summary from conversation
        const workSummary = this.extractWorkSummary(conversation);

        return {
            teamId: team.id,
            conversationId: conversation.getId(),
            taskDescription: team.taskDefinition?.description || "No description provided",
            completedWork: workSummary,
            timestamp: Date.now(),
        };
    }

    private extractWorkSummary(conversation: Conversation): ReviewRequest["completedWork"] {
        // This is a simplified version - in production, would analyze conversation
        // messages to extract actual work done, files modified, tests added, etc.

        // For now, return placeholder data
        const messages = conversation.getMessages();
        const codeBlocks = this.extractCodeBlocks(messages);
        const testMentions = this.countTestMentions(messages);

        return {
            filesModified: this.extractFileNames(messages),
            testsAdded: testMentions,
            testsPassed: testMentions, // Assume all tests pass for now
            linesOfCode: codeBlocks.reduce((sum, block) => sum + block.split("\n").length, 0),
            keyChanges: this.extractKeyChanges(messages),
        };
    }

    private extractCodeBlocks(messages: ConversationMessage[]): string[] {
        const codeBlocks: string[] = [];

        for (const msg of messages) {
            if (msg.role === "assistant" && msg.content) {
                // Extract code blocks from markdown
                const matches = msg.content.match(/```[\s\S]*?```/g) || [];
                codeBlocks.push(...matches.map((m: string) => m.replace(/```\w*\n?/g, "")));
            }
        }

        return codeBlocks;
    }

    private countTestMentions(messages: ConversationMessage[]): number {
        let count = 0;

        for (const msg of messages) {
            if (msg.content) {
                const testMatches = msg.content.match(/\b(test|spec|describe|it\()/gi) || [];
                count += testMatches.length;
            }
        }

        return Math.min(count, 10); // Cap at reasonable number
    }

    private extractFileNames(messages: ConversationMessage[]): string[] {
        const fileNames = new Set<string>();

        for (const msg of messages) {
            if (msg.content) {
                // Look for file paths - use non-capturing group for extensions
                const fileMatches = msg.content.match(/[\w/]+\.(?:ts|tsx|js|jsx|json|md)\b/g) || [];
                for (const f of fileMatches) {
                    fileNames.add(f);
                }
            }
        }

        return Array.from(fileNames).slice(0, 20); // Limit to 20 files
    }

    private extractKeyChanges(messages: ConversationMessage[]): string[] {
        const changes: string[] = [];

        for (const msg of messages) {
            if (msg.role === "assistant" && msg.content) {
                // Look for action words
                const lines = msg.content.split("\n");
                for (const line of lines) {
                    if (line.match(/^(added|created|implemented|fixed|updated|refactored)/i)) {
                        changes.push(line.trim());
                    }
                }
            }
        }

        return changes.slice(0, 10); // Limit to 10 key changes
    }
}
