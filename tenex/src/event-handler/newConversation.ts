import type { NDKEvent } from "@nostr-dev-kit/ndk";
import chalk from "chalk";
import { getProjectContext } from "../services";
import type { ConversationManager } from "../conversations";
import type { AgentExecutor } from "../agents/execution/AgentExecutor";
import { formatError } from "../utils/errors";
import { logger } from "../utils/logger";

const logInfo = logger.info.bind(logger);

interface EventHandlerContext {
    conversationManager: ConversationManager;
    agentExecutor: AgentExecutor;
}

export const handleNewConversation = async (
    event: NDKEvent,
    context: EventHandlerContext
): Promise<void> => {
    const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "New Conversation";
    logInfo(chalk.green(`\n🗣️  New conversation started: ${title}`));
    logInfo(chalk.gray("Content: ") + chalk.white(event.content));

    try {
        // Create conversation
        const conversation = await context.conversationManager.createConversation(event);

        // Get PM agent directly from project context
        const projectCtx = getProjectContext();
        const pmAgent = projectCtx.getProjectAgent();

        // Execute with PM agent to handle routing
        await context.agentExecutor.execute(
            {
                agent: pmAgent,
                conversation,
                phase: conversation.phase,
                lastUserMessage: event.content,
            },
            event
        );

        logInfo(chalk.green("✅ Conversation routed successfully"));
    } catch (error) {
        logInfo(chalk.red(`❌ Failed to route conversation: ${formatError(error)}`));
    }
};
