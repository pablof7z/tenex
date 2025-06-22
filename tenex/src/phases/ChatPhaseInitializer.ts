import type { ConversationState } from "@/conversations/types";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { projectContext } from "@/services";
import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/types";
import { logger } from "@/utils/logger";
import type { PhaseInitializationResult, PhaseInitializer } from "./types";
import { handlePhaseError } from "./utils";

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
      const project = projectContext.getCurrentProject();

      // In chat phase, the project responds directly
      // No specific agent is needed yet
      return {
        success: true,
        // Don't return a message - let the ConversationRouter handle the actual response
        metadata: {
          projectPubkey: new NDKPrivateKeySigner(projectContext.getCurrentProjectNsec()).pubkey,
          availableAgents: availableAgents.length,
          phase: "chat",
        },
      };
    } catch (error) {
      return handlePhaseError("Chat", error);
    }
  }
}
