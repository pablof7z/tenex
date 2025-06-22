import type { ConversationState } from "@/conversations/types";
import { getProjectContext } from "@/runtime";
import type { Agent } from "@/types/agent";
import type { Phase } from "@/types/conversation";
import { logger } from "@tenex/shared";
import type { PhaseInitializationResult, PhaseInitializer } from "./types";

/**
 * Chat Phase Initializer
 *
 * In the chat phase, the project itself responds initially to gather
 * requirements and understand the user's needs. No specific agent is
 * assigned yet.
 */
export class ChatPhaseInitializer implements PhaseInitializer {
  phase: Phase = "chat";

  async initialize(
    conversation: ConversationState,
    availableAgents: Agent[]
  ): Promise<PhaseInitializationResult> {
    logger.info("[CHAT Phase] Initializing chat phase", {
      conversationId: conversation.id,
      title: conversation.title,
    });

    try {
      const projectContext = getProjectContext();

      // In chat phase, the project responds directly
      // No specific agent is needed yet
      return {
        success: true,
        // Don't return a message - let the ConversationRouter handle the actual response
        metadata: {
          projectPubkey: projectContext.projectSigner.pubkey,
          availableAgents: availableAgents.length,
          phase: "chat",
        },
      };
    } catch (error) {
      logger.error("[CHAT Phase] Failed to initialize chat phase", { error });
      return {
        success: false,
        message: `Chat phase initialization failed: ${error}`,
      };
    }
  }
}
