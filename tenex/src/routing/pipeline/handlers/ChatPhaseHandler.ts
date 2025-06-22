import type { MessageHandler, RoutingContext } from "../types";
import { createProjectAgent } from "@/agents";
import { logger } from "@/utils/logger";

export class ChatPhaseHandler implements MessageHandler {
  name = "ChatPhaseHandler";

  canHandle(context: RoutingContext): boolean {
    // Handle chat phase responses
    return !context.handled && 
           context.conversation.phase === "chat" &&
           (!context.routingDecision || context.routingDecision.phase === "chat");
  }

  async handle(context: RoutingContext): Promise<RoutingContext> {
    logger.info("Handling chat phase response", {
      conversationId: context.conversation.id
    });

    // In chat phase, the project responds directly
    const projectAgent = createProjectAgent();
    
    const executionResult = await context.agentExecutor.execute(
      {
        agent: projectAgent,
        conversation: context.conversation,
        phase: "chat",
        lastUserMessage: context.event.content,
      },
      context.event
    );

    if (!executionResult.success) {
      logger.error("Project execution failed during chat phase", {
        error: executionResult.error
      });
      context.error = new Error(executionResult.error || "Chat execution failed");
    }

    context.handled = true;
    return context;
  }
}