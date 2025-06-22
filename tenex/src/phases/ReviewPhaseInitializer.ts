import type { Conversation } from "@/conversations/types";
import { projectContext } from "@/services";
import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/types";
import { logger } from "@/utils/logger";
import type { PhaseInitializationResult, PhaseInitializer } from "./types";
import { handlePhaseError } from "./utils";

/**
 * Review Phase Initializer
 *
 * In the review phase, expert agents review the implementation
 * and provide feedback. No automated tools are triggered.
 */
export class ReviewPhaseInitializer implements PhaseInitializer {
  phase: Phase = "review";

  async initialize(
    conversation: Conversation,
    availableAgents: Agent[]
  ): Promise<PhaseInitializationResult> {
    logger.info("[REVIEW Phase] Initializing review phase", {
      conversationId: conversation.id,
      title: conversation.title,
      previousPhase: "execute",
    });

    try {
      // Find agents suitable for review
      const reviewAgents = this.findReviewAgents(availableAgents);

      if (reviewAgents.length === 0) {
        return {
          success: false,
          message: "No suitable agents found for review phase",
        };
      }

      // Select the primary reviewer
      const primaryReviewer = reviewAgents[0];
      if (!primaryReviewer) {
        return {
          success: false,
          message: "No primary reviewer could be selected",
        };
      }

      // Get execution summary
      const executionSummary =
        conversation.metadata.execute_summary ||
        conversation.metadata.plan_summary ||
        "Implementation completed";

      const gitBranch = conversation.metadata.gitBranch || "main";

      return {
        success: true,
        message: `Review phase initialized. ${reviewAgents.length} reviewer(s) assigned.`,
        nextAgent: primaryReviewer.pubkey,
        metadata: {
          assignedReviewers: reviewAgents.map((a) => ({
            name: a.name,
            pubkey: a.pubkey,
            expertise: a.expertise,
          })),
          primaryReviewer: primaryReviewer.name,
          phase: "review",
          gitBranch,
          executionSummary,
          reviewersCount: reviewAgents.length,
        },
      };
    } catch (error) {
      return handlePhaseError("Review", error);
    }
  }

  private findReviewAgents(agents: Agent[]): Agent[] {
    // Prioritize agents with review-related roles or expertise
    const reviewKeywords = [
      "review",
      "quality",
      "testing",
      "security",
      "architect",
      "senior",
      "expert",
      "lead",
    ];

    const reviewAgents = agents.filter((agent) => {
      const roleMatch = reviewKeywords.some((keyword) =>
        agent.role.toLowerCase().includes(keyword)
      );
      const expertiseMatch = reviewKeywords.some((keyword) =>
        agent.expertise.toLowerCase().includes(keyword)
      );
      return roleMatch || expertiseMatch;
    });

    // If no specific review agents found, use all available agents
    if (reviewAgents.length === 0) {
      return agents.slice(0, 3); // Limit to 3 reviewers max
    }

    // Return up to 3 review agents
    return reviewAgents.slice(0, 3);
  }
}
