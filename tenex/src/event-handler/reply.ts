import type { NDKEvent } from "@nostr-dev-kit/ndk";
import chalk from "chalk";
import { Message } from "multi-llm-ts";
import type { AgentExecutor } from "../agents/execution/AgentExecutor";
import type {
  AgentExecutionContextWithHandoff
} from "../agents/execution/types";
import type { ConversationManager } from "../conversations";
import { NostrPublisher } from "../nostr";
import { isEventFromUser } from "../nostr/utils";
import { getProjectContext } from "../services";
import { formatError } from "../utils/errors";
import { logger } from "../utils/logger";

const logInfo = logger.info.bind(logger);

interface EventHandlerContext {
  conversationManager: ConversationManager;
  agentExecutor: AgentExecutor;
}

export const handleChatMessage = async (
  event: NDKEvent,
  context: EventHandlerContext
): Promise<void> => {
  logInfo(
    chalk.gray("Message: ") +
      chalk.white(event.content.substring(0, 100) + (event.content.length > 100 ? "..." : ""))
  );

  // Extract p-tags to identify mentioned agents
  const pTags = event.tags.filter((tag) => tag[0] === "p");
  const mentionedPubkeys = pTags
    .map((tag) => tag[1])
    .filter((pubkey): pubkey is string => !!pubkey);

  if (mentionedPubkeys.length > 0) {
    logInfo(
      chalk.gray("P-tags:  ") +
        chalk.cyan(`${mentionedPubkeys.length} pubkeys mentioned: ${mentionedPubkeys.join(", ")}`)
    );
  }

  // Check if this message is directed to the system (project or agents)
  if (pTags.length > 0) {
    const projectCtx = getProjectContext();
    const systemPubkeys = new Set([
      projectCtx.pubkey,
      ...Array.from(projectCtx.agents.values()).map((a) => a.pubkey),
    ]);

    const isDirectedToSystem = mentionedPubkeys.some((pubkey) => systemPubkeys.has(pubkey));

    if (!isDirectedToSystem) {
      logInfo(
        chalk.gray(
          "Message is not directed to system (p-tags point to external users), skipping routing"
        )
      );
      return;
    }
  }

  // This is a reply within an existing conversation
  try {
    await handleReplyLogic(event, context, mentionedPubkeys);
  } catch (error) {
    logInfo(chalk.red(`❌ Failed to route reply: ${formatError(error)}`));
  }
};

async function handleReplyLogic(
  event: NDKEvent,
  { conversationManager, agentExecutor }: EventHandlerContext,
  mentionedPubkeys: string[]
): Promise<void> {
  // Find the conversation this reply belongs to
  const conversation = conversationManager.getConversationByEvent(
    event.tagValue("E") || ""
  );

  if (!conversation) {
    logger.error("No conversation found for reply", { eventId: event.id });
    return;
  }

  // Add event to conversation history
  await conversationManager.addEvent(conversation.id, event);

  // Get PM agent directly from project context
  const projectCtx = getProjectContext();
  const orchestratorAgent = projectCtx.getProjectAgent();

  // Determine which agent should handle this event
  let targetAgent = orchestratorAgent; // Default to orchestrator agent

  // Check for p-tagged agents regardless of sender
  if (mentionedPubkeys.length > 0) {
    // Find the first p-tagged system agent
    for (const pubkey of mentionedPubkeys) {
      const agent = Array.from(projectCtx.agents.values()).find((a) => a.pubkey === pubkey);
      if (agent) {
        // For non-user events, skip if agent is the author (prevent loops)
        if (!isEventFromUser(event) && agent.pubkey === event.pubkey) {
          continue;
        }
        targetAgent = agent;
        logger.info(`Routing to p-tagged agent: ${agent.name} (${agent.pubkey})`);
        break;
      }
    }
  }

  // For non-user events without valid p-tags, skip processing
  if (
    !isEventFromUser(event) &&
    targetAgent === orchestratorAgent &&
    !mentionedPubkeys.includes(orchestratorAgent.pubkey)
  ) {
    logger.info("Event is not from user and doesn't p-tag any valid agent, skipping");
    return;
  }

  // Check for recent phase transition that might be a handoff for this agent
  let handoff = undefined;
  if (conversation.phaseTransitions.length > 0) {
    const recentTransition =
      conversation.phaseTransitions[conversation.phaseTransitions.length - 1];

    // If this transition was very recent (within last 30 seconds) and has handoff info
    if (
      recentTransition &&
      Date.now() - recentTransition.timestamp < 30000 &&
      recentTransition.summary
    ) {
      handoff = recentTransition;
    }
  }

  // Execute with the appropriate agent
  const executionContext: AgentExecutionContextWithHandoff = {
    agent: targetAgent,
    conversation,
    phase: conversation.phase,
  };

  // Add handoff if available
  if (handoff) {
    executionContext.handoff = handoff;
  }

  // Add the user message to the target agent's context if this is from a user
  if (isEventFromUser(event) && event.content) {
    logger.info("[REPLY_HANDLER] Adding user message to agent context", {
      conversationId: conversation.id,
      targetAgent: targetAgent.slug,
      userMessage: `${event.content.substring(0, 100)}...`,
    });

    await conversationManager.addMessageToContext(
      conversation.id,
      targetAgent.slug,
      new Message("user", event.content)
    );
  }

  const result = await agentExecutor.execute(executionContext, event);

  // Check if execution failed and notify user
  if (!result.success && result.error) {
    // Check if it's an insufficient credits error
    const isCreditsError =
      result.error.includes("Insufficient credits") || result.error.includes("402");

    const errorMessage = isCreditsError
      ? "⚠️ Unable to process your request: Insufficient credits. Please add more credits at https://openrouter.ai/settings/credits to continue."
      : "⚠️ Unable to process your request due to an error. Please try again later.";

    // Create NostrPublisher to publish error
    const publisher = new NostrPublisher({
      conversation,
      agent: orchestratorAgent,
      triggeringEvent: event,
      conversationManager,
    });

    await publisher.publishError(errorMessage);

    logger.error(
      isCreditsError
        ? "Agent execution failed due to insufficient credits"
        : "Agent execution failed",
      {
        error: result.error,
        conversation: conversation.id,
      }
    );
  }
}
