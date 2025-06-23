import type { Phase, Conversation } from "@/conversations/types";
import type { Agent } from "@/agents/types";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { PhaseInitializationResult } from "@/phases/types";
import type { ConversationPublisher } from "@/nostr";
import type { AgentExecutor } from "@/agents";
import type { ConversationManager } from "@/conversations";
import { createProjectAgent } from "@/agents/agentFactoryFunctions";
import { logger } from "@/utils/logger";

export interface PhaseInitializationContext {
  phase: Phase;
  conversation: Conversation;
  result: PhaseInitializationResult;
  availableAgents: Agent[];
  event: NDKEvent;
  publisher: ConversationPublisher;
  agentExecutor: AgentExecutor;
  conversationManager: ConversationManager;
}

/**
 * Handles the common phase initialization response logic
 */
export async function handlePhaseInitializationResponse(
  context: PhaseInitializationContext
): Promise<void> {
  const { phase, conversation, result, availableAgents, event, publisher, agentExecutor, conversationManager } = context;

  if (phase === "chat") {
    // In chat phase, project responds using LLM
    const projectAgent = createProjectAgent();

    const executionResult = await agentExecutor.execute(
      {
        agent: projectAgent,
        conversation,
        phase,
        lastUserMessage: event.content,
      },
      event
    );

    if (!executionResult.success) {
      logger.error("Project chat execution failed", {
        error: executionResult.error
      });
      // Fallback to a generic message if execution fails
      await publisher.publishProjectResponse(
        event,
        "I'm having trouble processing your request. Could you please rephrase it?",
        { phase, error: true }
      );
    }
  } else if (result.nextAgent) {
    // In other phases, assigned agent responds
    const agent = availableAgents.find(a => a.pubkey === result.nextAgent);
    if (agent) {
      await conversationManager.updateCurrentAgent(conversation.id, agent.pubkey);

      const executionResult = await agentExecutor.execute(
        {
          agent,
          conversation,
          phase,
          projectContext: result.metadata,
        },
        event
      );

      if (!executionResult.success) {
        logger.error("Agent execution failed during phase initialization", {
          agent: agent.name,
          phase,
          error: executionResult.error
        });
      }
    }
  } else if (phase === "plan" && result.metadata?.claudeCodeTriggered) {
    // Plan phase with Claude Code - just publish a status message
    await publisher.publishProjectResponse(
      event,
      result.message || "Claude Code is working on the implementation plan.",
      { phase, claudeCodeActive: true }
    );
  }
}