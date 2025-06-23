import type { MessageHandler, RoutingContext } from "../types";
import type { Phase } from "@/conversations/types";
import { 
  canTransitionPhase, 
  meetsPhaseTransitionCriteria 
} from "@/routing/routingDomain";
import { getProjectContext } from "@/services";
import { RequirementsExtractor } from "@/services/RequirementsExtractor";
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
      const projectCtx = getProjectContext();
      const projectAgent = projectCtx.getProjectAgent();
      
      await context.publisher.publishAgentResponse(
        context.event,
        `Cannot transition from ${currentPhase} to ${requestedPhase} phase directly.`,
        "",
        projectAgent.signer,
        undefined,
        [["phase", currentPhase], ["error", "true"]]
      );
      context.handled = true;
      return context;
    }

    // If transitioning to plan phase and no requirements exist, extract them
    if (requestedPhase === "plan" && currentPhase === "chat" && !context.conversation.metadata.requirements) {
      logger.info("Extracting requirements before phase transition");
      
      const extractedRequirements = await RequirementsExtractor.extractRequirements(
        context.conversation,
        context.conversationManager.getProjectPath()
      );
      
      if (extractedRequirements) {
        // Update conversation metadata with extracted requirements
        const formattedRequirements = RequirementsExtractor.formatRequirements(extractedRequirements);
        await context.conversationManager.updateMetadata(
          context.conversation.id,
          {
            ...context.conversation.metadata,
            requirements: formattedRequirements
          }
        );
        
        // Update the conversation object in context to reflect the new metadata
        context.conversation.metadata.requirements = formattedRequirements;
        
        logger.info("Requirements extracted and stored successfully");
      } else {
        logger.warn("Failed to extract requirements from conversation");
      }
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
      
      const projectCtx = getProjectContext();
      const projectAgent = projectCtx.getProjectAgent();
      
      await context.publisher.publishAgentResponse(
        context.event,
        `Cannot transition to ${requestedPhase} phase: ${transitionCheck.reason}`,
        "",
        projectAgent.signer,
        undefined,
        [["phase", currentPhase], ["error", "true"]]
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