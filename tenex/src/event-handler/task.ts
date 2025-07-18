import type { NDKEvent, NDKTask } from "@nostr-dev-kit/ndk";
import chalk from "chalk";
import type { AgentExecutor } from "../agents/execution/AgentExecutor";
import type { ConversationManager } from "../conversations";
import { getProjectContext } from "../services";
import { formatError } from "../utils/errors";
import { logger } from "../utils/logger";
import { Agent } from "@/agents";

const logInfo = logger.info.bind(logger);

interface EventHandlerContext {
    conversationManager: ConversationManager;
    agentExecutor: AgentExecutor;
}

export const handleTask = async (event: NDKTask, context: EventHandlerContext): Promise<void> => {
    const title = event.title;
    logInfo(chalk.gray("Task:    ") + chalk.yellow(title));
    logInfo(
        chalk.gray("Content: ") +
            chalk.white(event.content.substring(0, 100) + (event.content.length > 100 ? "..." : ""))
    );

    // Extract p-tags to identify mentioned agents
    const pTags = event.tags.filter((tag) => tag[0] === "p");
    const mentionedPubkeys = pTags.map((tag) => tag[1]).filter((pubkey): pubkey is string => !!pubkey);

    if (mentionedPubkeys.length > 0) {
        logInfo(
            chalk.gray("P-tags:  ") + chalk.cyan(`${mentionedPubkeys.length} pubkeys mentioned`)
        );
    }

    try {
        // Create conversation from NDKTask
        const conversation = await context.conversationManager.createConversation(event);
        
        // Log the claude-session tag if present
        const claudeSession = event.tagValue('claude-session');
        if (claudeSession) {
            logInfo(chalk.gray("Claude Session: ") + chalk.cyan(claudeSession));
        }

        // Get orchestrator agent directly from project context
        const projectCtx = getProjectContext();
        const orchestratorAgent = projectCtx.getProjectAgent();

        let targetAgent: Agent | undefined;

        // If there are p-tags, check if any match system agents
        if (mentionedPubkeys.length > 0) {
            for (const pubkey of mentionedPubkeys) {
                const agent = Array.from(projectCtx.agents.values()).find(
                    (a) => a.pubkey === pubkey
                );
                if (agent) {
                    targetAgent = agent;
                    logInfo(chalk.cyan(`Routing to p-tagged agent: ${agent.name}`));
                    break;
                }
            }
        } else {
            targetAgent = orchestratorAgent;
        }

        if (!targetAgent) {
            logInfo(chalk.green("✅ Not routing to any agent", { mentionedPubkeys }));
            return;
        }

        // Execute with the appropriate agent
        await context.agentExecutor.execute({
            agent: targetAgent,
            conversationId: conversation.id,
            phase: conversation.phase,
            projectPath: process.cwd(),
            triggeringEvent: event,
            publisher: new (await import("@/nostr/NostrPublisher")).NostrPublisher({
                conversationId: conversation.id,
                agent: targetAgent,
                triggeringEvent: event,
                conversationManager: context.conversationManager,
            }),
            conversationManager: context.conversationManager,
            claudeSessionId: claudeSession,
        });

        logInfo(chalk.green("✅ Task conversation created and routed successfully"));
    } catch (error) {
        logInfo(chalk.red(`❌ Failed to create task conversation: ${formatError(error)}`));
    }
};
