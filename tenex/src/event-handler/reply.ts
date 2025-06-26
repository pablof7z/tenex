import type { NDKEvent } from "@nostr-dev-kit/ndk";
import chalk from "chalk";
import { getProjectContext } from "../services";
import type { ConversationManager } from "../conversations";
import type { AgentExecutor } from "../agents/execution/AgentExecutor";
import { formatError } from "../utils/errors";
import { logger } from "../utils/logger";
import { isEventFromUser } from "../nostr/utils";
import { NostrPublisher } from "../nostr";
import { getNDK } from "../nostr/ndkClient";

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
                chalk.cyan(
                    `${mentionedPubkeys.length} pubkeys mentioned: ${mentionedPubkeys.join(", ")}`
                )
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
        event.tags.find((tag) => tag[0] === "E")?.[1] || ""
    );

    if (!conversation) {
        logger.error("No conversation found for reply", { eventId: event.id });
        return;
    }

    // Add event to conversation history
    await conversationManager.addEvent(conversation.id, event);

    // Get PM agent directly from project context
    const projectCtx = getProjectContext();
    const pmAgent = projectCtx.getProjectAgent();

    // Determine which agent should handle this event
    let targetAgent = pmAgent; // Default to PM agent
    
    // Check if this is an agent-to-agent message (not from user)
    if (!isEventFromUser(event)) {
        // Find the first p-tagged system agent that isn't the author (prevent loops)
        for (const pubkey of mentionedPubkeys) {
            const agent = Array.from(projectCtx.agents.values()).find(a => a.pubkey === pubkey);
            if (agent && agent.pubkey !== event.pubkey) {
                targetAgent = agent;
                logger.info(`Routing to p-tagged agent: ${agent.name} (${agent.pubkey})`);
                break;
            }
        }
        
        // If no valid target agent found, skip processing
        if (targetAgent === pmAgent && !mentionedPubkeys.includes(pmAgent.pubkey)) {
            logger.info("Event is not from user and doesn't p-tag any valid agent, skipping");
            return;
        }
    }

    // Execute with the appropriate agent
    const result = await agentExecutor.execute(
        {
            agent: targetAgent,
            conversation,
            phase: conversation.phase,
        },
        event
    );

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
            ndk: getNDK(),
            conversation,
            agent: pmAgent,
            triggeringEvent: event,
            project: projectCtx.project
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
