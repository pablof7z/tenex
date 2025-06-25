import type { NDKEvent } from "@nostr-dev-kit/ndk";
import chalk from "chalk";
import { getProjectContext } from "../services";
import type { ConversationManager } from "../conversations";
import type { AgentExecutor } from "../agents/execution/AgentExecutor";
import { formatError } from "../utils/errors";
import { logger } from "../utils/logger";
import { isEventFromUser } from "../nostr/utils";
import { publishErrorNotification } from "../nostr";

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
        await handleReplyLogic(event, context);
    } catch (error) {
        logInfo(chalk.red(`❌ Failed to route reply: ${formatError(error)}`));
    }
};

async function handleReplyLogic(
    event: NDKEvent,
    { conversationManager, agentExecutor }: EventHandlerContext
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

    // Only respond to user messages
    if (!isEventFromUser(event)) {
        logger.info("Event is not from user, not sending to any agent")
        return;
    }

    // Get PM agent directly from project context
    const projectCtx = getProjectContext();
    const pmAgent = projectCtx.getProjectAgent();

    // Execute with PM agent to handle routing
    const result = await agentExecutor.execute(
        {
            agent: pmAgent,
            conversation,
            phase: conversation.phase,
        },
        event
    );
    
    // Check if execution failed and notify user
    if (!result.success && result.error) {
        // Check if it's an insufficient credits error
        const isCreditsError = result.error.includes("Insufficient credits") || 
                             result.error.includes("402");
        
        if (isCreditsError) {
            const errorMessage = "⚠️ Unable to process your request: Insufficient credits. Please add more credits at https://openrouter.ai/settings/credits to continue.";
            
            // Publish error notification to user
            await publishErrorNotification(
                event,
                errorMessage,
                pmAgent.signer
            );
            
            logger.error("Agent execution failed due to insufficient credits", {
                error: result.error,
                conversation: conversation.id,
            });
        } else {
            // For other errors, publish a generic error message
            const errorMessage = `⚠️ Unable to process your request due to an error. Please try again later.`;
            
            await publishErrorNotification(
                event,
                errorMessage,
                pmAgent.signer
            );
            
            logger.error("Agent execution failed", {
                error: result.error,
                conversation: conversation.id,
            });
        }
    }
}
