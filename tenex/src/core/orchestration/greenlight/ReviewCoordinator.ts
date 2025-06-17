import type {
    ReviewCoordinator,
    ReviewDecision,
    ReviewRequest,
} from "@/core/orchestration/greenlight/types";
import type { LLMProvider, Team } from "@/core/orchestration/types";
import type { Agent } from "@/utils/agents/Agent";
import type { Conversation } from "@/utils/agents/Conversation";
import type { AgentLogger } from "@tenex/shared/logger";

export class ReviewCoordinatorImpl implements ReviewCoordinator {
    private static readonly DEFAULT_REVIEW_TIMEOUT = 300000; // 5 minutes
    private static readonly MAX_REVIEWERS = 3;

    constructor(
        private readonly llmProvider: LLMProvider,
        private readonly agents: Map<string, Agent>,
        private readonly logger: AgentLogger
    ) {
        if (!llmProvider) throw new Error("LLMProvider is required");
        if (!agents) throw new Error("Agents map is required");
        if (!logger) throw new Error("Logger is required");
    }

    async selectReviewers(team: Team, excludeMembers: string[] = []): Promise<string[]> {
        // Get all available agents except team members and excluded agents
        const excludeSet = new Set([...team.members, ...excludeMembers, team.lead]);
        const availableReviewers: string[] = [];

        for (const [agentName] of this.agents) {
            if (!excludeSet.has(agentName)) {
                availableReviewers.push(agentName);
            }
        }

        if (availableReviewers.length === 0) {
            this.logger.warning("No available reviewers found outside the team");
            return [];
        }

        // Use LLM to select appropriate reviewers based on task
        const selectedReviewers = await this.selectReviewersWithLLM(team, availableReviewers);

        return selectedReviewers.slice(0, ReviewCoordinatorImpl.MAX_REVIEWERS);
    }

    async collectReviews(
        reviewers: string[],
        conversation: Conversation,
        reviewRequest: ReviewRequest
    ): Promise<ReviewDecision[]> {
        if (reviewers.length === 0) {
            return [];
        }

        this.logger.info(`Collecting reviews from ${reviewers.length} reviewers`);

        // Collect reviews in parallel with timeout
        const reviewPromises = reviewers.map(async (reviewerName) => {
            try {
                const reviewer = this.agents.get(reviewerName);
                if (!reviewer) {
                    this.logger.error(`Reviewer agent ${reviewerName} not found`);
                    return null;
                }

                return await this.collectReviewFromAgent(reviewer, conversation, reviewRequest);
            } catch (error) {
                this.logger.error(`Failed to collect review from ${reviewerName}: ${error}`);
                return null;
            }
        });

        // Use Promise.allSettled with timeout
        const timeoutPromise = new Promise<null>((_, reject) => {
            setTimeout(
                () => reject(new Error("Review timeout")),
                ReviewCoordinatorImpl.DEFAULT_REVIEW_TIMEOUT
            );
        });

        try {
            const results = (await Promise.race([
                Promise.allSettled(reviewPromises),
                timeoutPromise,
            ])) as PromiseSettledResult<ReviewDecision | null>[];

            const decisions: ReviewDecision[] = [];
            for (const result of results) {
                if (result.status === "fulfilled" && result.value) {
                    decisions.push(result.value);
                }
            }

            return decisions;
        } catch (error) {
            this.logger.error(`Review collection timed out: ${error}`);
            return [];
        }
    }

    private async selectReviewersWithLLM(
        team: Team,
        availableReviewers: string[]
    ): Promise<string[]> {
        const prompt = this.buildReviewerSelectionPrompt(team, availableReviewers);
        const response = await this.llmProvider.complete(prompt);

        try {
            const selectedNames = JSON.parse(response.content) as string[];
            // Validate that selected names are in available reviewers
            return selectedNames.filter((name) => availableReviewers.includes(name));
        } catch (error) {
            this.logger.error(`Failed to parse reviewer selection: ${error}`);
            // Fallback to random selection
            return this.randomSelectReviewers(availableReviewers);
        }
    }

    private randomSelectReviewers(availableReviewers: string[]): string[] {
        const shuffled = [...availableReviewers].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(ReviewCoordinatorImpl.MAX_REVIEWERS, shuffled.length));
    }

    private async collectReviewFromAgent(
        reviewer: Agent,
        conversation: Conversation,
        reviewRequest: ReviewRequest
    ): Promise<ReviewDecision> {
        const prompt = this.buildReviewPrompt(reviewer, conversation, reviewRequest);
        const response = await this.llmProvider.complete(prompt);

        try {
            const reviewData = JSON.parse(response.content) as {
                decision: "approve" | "reject" | "revise";
                feedback: string;
                confidence: number;
                suggestedChanges?: string[];
            };

            return {
                reviewerName: reviewer.getName(),
                decision: reviewData.decision,
                feedback: reviewData.feedback,
                confidence: reviewData.confidence,
                suggestedChanges: reviewData.suggestedChanges,
                timestamp: Date.now(),
            };
        } catch (error) {
            this.logger.error(`Failed to parse review from ${reviewer.getName()}: ${error}`);
            throw error;
        }
    }

    private buildReviewerSelectionPrompt(team: Team, availableReviewers: string[]): string {
        const agentDescriptions = availableReviewers
            .map((name) => {
                const agent = this.agents.get(name);
                return `- ${name}: ${agent?.getConfig()?.role || "No role specified"}`;
            })
            .join("\n");

        return `Select the most appropriate reviewers for a task completed by team ${team.id}.

Task Details:
- Strategy: ${team.strategy}
- Team Lead: ${team.lead}
- Team Members: ${team.members.join(", ")}
- Task: ${team.taskDefinition?.description || "Not specified"}

Available Reviewers:
${agentDescriptions}

Select up to ${ReviewCoordinatorImpl.MAX_REVIEWERS} reviewers who:
1. Have relevant expertise for reviewing this task
2. Are not part of the team that completed the work
3. Can provide valuable feedback

Respond with a JSON array of reviewer names: ["reviewer1", "reviewer2", ...]`;
    }

    private buildReviewPrompt(
        reviewer: Agent,
        conversation: Conversation,
        reviewRequest: ReviewRequest
    ): string {
        // Get recent conversation messages for context
        const recentMessages = this.getRecentConversationContext(conversation);

        return `You are ${reviewer.getName()}, acting as a code reviewer for completed work.

Task Description: ${reviewRequest.taskDescription}

Work Summary:
- Files Modified: ${reviewRequest.completedWork.filesModified.join(", ")}
- Tests Added: ${reviewRequest.completedWork.testsAdded}
- Tests Passed: ${reviewRequest.completedWork.testsPassed}
- Lines of Code: ${reviewRequest.completedWork.linesOfCode}
- Key Changes: 
${reviewRequest.completedWork.keyChanges.map((change) => `  - ${change}`).join("\n")}

Recent Conversation Context:
${recentMessages}

Review the completed work and provide your assessment.

Respond with a JSON object:
{
    "decision": "approve" | "reject" | "revise",
    "feedback": "Detailed feedback explaining your decision",
    "confidence": 0.0-1.0,
    "suggestedChanges": ["Optional array of specific changes needed"] // Only if decision is "revise" or "reject"
}

Consider:
- Code quality and best practices
- Test coverage and quality
- Edge cases and error handling
- Performance implications
- Security considerations
- Documentation and clarity`;
    }

    private getRecentConversationContext(conversation: Conversation): string {
        const messages = conversation.getMessages();
        const recentMessages = messages.slice(-10); // Last 10 messages

        return recentMessages
            .map((msg) => `[${msg.role}]: ${msg.content.substring(0, 200)}...`)
            .join("\n");
    }
}
