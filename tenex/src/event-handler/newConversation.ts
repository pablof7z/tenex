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

        // Check for p-tags to determine target agent
        const pTags = event.tags.filter((tag) => tag[0] === "p");
        const mentionedPubkeys = pTags
            .map((tag) => tag[1])
            .filter((pubkey): pubkey is string => !!pubkey);

        let targetAgent = pmAgent; // Default to PM agent

        // If there are p-tags, check if any match system agents
        if (mentionedPubkeys.length > 0) {
            for (const pubkey of mentionedPubkeys) {
                const agent = Array.from(projectCtx.agents.values()).find(a => a.pubkey === pubkey);
                if (agent) {
                    targetAgent = agent;
                    logInfo(chalk.cyan(`Routing to p-tagged agent: ${agent.name}`));
                    break;
                }
            }
        }

        // Execute with the appropriate agent
        await context.agentExecutor.execute(
            {
                agent: targetAgent,
                conversation,
                phase: conversation.phase,
            },
            event
        );

        logInfo(chalk.green("✅ Conversation routed successfully"));
    } catch (error) {
        logInfo(chalk.red(`❌ Failed to route conversation: ${formatError(error)}`));
    }
};
