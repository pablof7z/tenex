import type { MessageHandler, RoutingContext } from "../types";
import type { Phase } from "@/conversations/types";
import { 
  canTransitionPhase, 
  meetsPhaseTransitionCriteria 
} from "@/routing/routingDomain";
import { logger } from "@/utils/logger";

export class PhaseTransitionHandler implements MessageHandler {
  name = "PhaseTransitionHandler";

  canHandle(context: RoutingContext): boolean {
    // Handle explicit phase transition requests
    return context.event.tags.some(tag => tag[0] === "phase");
  }

  async handle(context: RoutingContext): Promise<RoutingContext> {
    const phaseTag = context.event.tags.find(tag => tag[0] === "phase");
    if (!phaseTag) return context;

    const requestedPhase = phaseTag[1] as Phase;
    const currentPhase = context.conversation.phase;

    logger.info("Phase transition requested", {
      from: currentPhase,
      to: requestedPhase,
      conversationId: context.conversation.id
    });

    // Validate phase transition is allowed
    if (!canTransitionPhase(currentPhase, requestedPhase)) {
      await context.publisher.publishProjectResponse(
        context.event,
        `Cannot transition from ${currentPhase} to ${requestedPhase} phase directly.`,
        { phase: currentPhase, error: true }
      );
      context.handled = true;
      return context;
    }

    // Check if transition criteria are met
    const transitionCheck = meetsPhaseTransitionCriteria(
      context.conversation,
      requestedPhase
    );

    if (!transitionCheck.canTransition) {
      logger.warn("Phase transition criteria not met", {
        from: currentPhase,
        to: requestedPhase,
        reason: transitionCheck.reason
      });
      
      await context.publisher.publishProjectResponse(
        context.event,
        `Cannot transition to ${requestedPhase} phase: ${transitionCheck.reason}`,
        { phase: currentPhase, error: true }
      );
      context.handled = true;
      return context;
    }

    // Set routing decision for phase transition
    context.routingDecision = {
      phase: requestedPhase,
      reasoning: "User requested phase transition",
      confidence: 1.0
    };

    // Don't mark as handled - let the pipeline execute the transition
    return context;
  }
}