import type { MessageHandler, RoutingContext } from "../types";
import { getDefaultAgentForPhase } from "@/routing/routingDomain";
import { logger } from "@/utils/logger";

export class AgentRoutingHandler implements MessageHandler {
  name = "AgentRoutingHandler";

  canHandle(context: RoutingContext): boolean {
    // Handle if we have a routing decision with an agent assignment
    return !context.handled && 
           !!context.routingDecision?.nextAgent &&
           context.conversation.phase !== "chat";
  }

  async handle(context: RoutingContext): Promise<RoutingContext> {
    const { routingDecision, conversation, availableAgents } = context;
    
    if (!routingDecision?.nextAgent) return context;

    // Update current agent
    await context.conversationManager.updateCurrentAgent(
      conversation.id,
      routingDecision.nextAgent
    );

    // Find the assigned agent
    let agent = availableAgents.find(a => a.pubkey === routingDecision.nextAgent);

    // If agent not found, try to assign a default one
    if (!agent) {
      agent = getDefaultAgentForPhase(conversation.phase, availableAgents) || undefined;
      if (agent) {
        logger.info("Assigned default agent for phase", {
          phase: conversation.phase,
          agent: agent.name
        });
        await context.conversationManager.updateCurrentAgent(conversation.id, agent.pubkey);
      }
    }

    if (agent) {
      // Execute the agent to generate response
      const executionResult = await context.agentExecutor.execute(
        {
          agent,
          conversation,
          phase: conversation.phase,
          lastUserMessage: context.event.content,
        },
        context.event
      );

      if (!executionResult.success) {
        logger.error("Agent execution failed during reply routing", {
          agent: agent.name,
          error: executionResult.error
        });
        context.error = new Error(executionResult.error || "Agent execution failed");
      }

      context.handled = true;
    }

    return context;
  }
}