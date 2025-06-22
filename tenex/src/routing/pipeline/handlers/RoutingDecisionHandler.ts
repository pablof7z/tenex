import type { MessageHandler, RoutingContext } from "../types";
import type { Conversation, ConversationState } from "@/conversations/types";
import { 
  applyBusinessRules, 
  meetsPhaseTransitionCriteria 
} from "@/routing/routingDomain";
import { logger } from "@/utils/logger";

export class RoutingDecisionHandler implements MessageHandler {
  name = "RoutingDecisionHandler";

  canHandle(context: RoutingContext): boolean {
    // Handle if no routing decision has been made yet
    return !context.handled && !context.routingDecision;
  }

  async handle(context: RoutingContext): Promise<RoutingContext> {
    // Get routing decision from LLM
    let routingDecision = await context.routingLLM.routeNextAction(
      this.convertToConversation(context.conversation),
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

  private convertToConversation(state: ConversationState): Conversation {
    const metadata: Record<string, string | number | boolean | string[]> = {};
    
    // Convert known fields
    if (state.metadata.branch !== undefined) metadata.branch = state.metadata.branch;
    if (state.metadata.summary !== undefined) metadata.summary = state.metadata.summary;
    if (state.metadata.requirements !== undefined) metadata.requirements = state.metadata.requirements;
    if (state.metadata.plan !== undefined) metadata.plan = state.metadata.plan;
    
    // Convert other fields with type checking
    for (const [key, value] of Object.entries(state.metadata)) {
      if (key === 'branch' || key === 'summary' || key === 'requirements' || key === 'plan') {
        continue; // Already handled
      }
      
      // Only include values that match the Conversation metadata type
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        (Array.isArray(value) && value.every(v => typeof v === 'string'))
      ) {
        metadata[key] = value;
      }
    }
    
    return {
      id: state.id,
      title: state.title,
      phase: state.phase,
      history: state.history,
      currentAgent: state.currentAgent,
      phaseStartedAt: state.phaseStartedAt,
      metadata,
    };
  }
}