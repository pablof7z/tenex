import type { MessageHandler, RoutingContext } from "../types";
import type { Conversation } from "@/conversations/types";
import { 
  applyBusinessRules, 
  meetsPhaseTransitionCriteria 
} from "@/routing/routingDomain";
import { logger } from "@/utils/logger";

export class RoutingDecisionHandler implements MessageHandler {
  name = "RoutingDecisionHandler";

  canHandle(context: RoutingContext): boolean {
    // Skip routing decision if already in chat phase - project should respond directly
    if (context.conversation.phase === "chat") {
      return false;
    }
    
    // Handle if no routing decision has been made yet
    return !context.handled && !context.routingDecision;
  }

  async handle(context: RoutingContext): Promise<RoutingContext> {
    // Get routing decision from LLM
    let routingDecision = await context.routingLLM.routeNextAction(
      context.conversation,
      context.event.content || "",
      context.availableAgents
    );

    // Apply business rules
    routingDecision = applyBusinessRules(
      routingDecision,
      context.conversation,
      context.availableAgents
    );

    // Validate phase transition if needed
    if (routingDecision.phase !== context.conversation.phase) {
      const transitionCheck = meetsPhaseTransitionCriteria(
        context.conversation,
        routingDecision.phase
      );

      if (!transitionCheck.canTransition) {
        logger.warn("Phase transition blocked by business rules", {
          from: context.conversation.phase,
          to: routingDecision.phase,
          reason: transitionCheck.reason
        });
        // Stay in current phase
        routingDecision.phase = context.conversation.phase;
      }
    }

    context.routingDecision = routingDecision;
    return context;
  }

}