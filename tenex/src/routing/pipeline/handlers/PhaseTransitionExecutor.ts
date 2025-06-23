import type { MessageHandler, RoutingContext } from "../types";
import type { Phase, Conversation } from "@/conversations/types";
import type { PhaseInitializationResult } from "@/phases/types";
import type { Agent } from "@/agents/types";
import { initializePhase } from "@/phases";
import { projectContext } from "@/services";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { handlePhaseInitializationResponse } from "@/routing/phase-initialization";
import { logger } from "@/utils/logger";

export class PhaseTransitionExecutor implements MessageHandler {
  name = "PhaseTransitionExecutor";

  canHandle(context: RoutingContext): boolean {
    // Handle if we need to transition phases
    return !context.handled && 
           !!context.routingDecision &&
           context.routingDecision.phase !== context.conversation.phase;
  }

  async handle(context: RoutingContext): Promise<RoutingContext> {
    const { conversation, routingDecision, availableAgents, event } = context;
    
    if (!routingDecision) return context;

    const oldPhase = conversation.phase;
    const newPhase = routingDecision.phase;

    logger.info("Executing phase transition", {
      conversationId: conversation.id,
      from: oldPhase,
      to: newPhase
    });

    // Compact conversation history for the new phase
    const compactedContext = await context.conversationManager.compactHistory(
      conversation.id, 
      newPhase
    );

    // Publish phase transition event
    const projectNsec = projectContext.getCurrentProjectNsec();
    const projectSigner = new NDKPrivateKeySigner(projectNsec);
    
    await context.publisher.publishPhaseTransition(
      conversation,
      newPhase,
      compactedContext,
      projectSigner,
      event
    );

    // Update conversation phase
    await context.conversationManager.updatePhase(conversation.id, newPhase);

    // Initialize the new phase
    const result = await initializePhase(newPhase, conversation, availableAgents);

    logger.info("Phase initialized", {
      conversationId: conversation.id,
      phase: newPhase,
      success: result.success,
      nextAgent: result.nextAgent
    });

    // Update conversation metadata with initialization result
    await context.conversationManager.updateMetadata(conversation.id, {
      [`${newPhase}_init`]: result
    });

    // Handle phase-specific initialization responses
    await handlePhaseInitializationResponse({
      phase: newPhase,
      conversation,
      result,
      availableAgents,
      event,
      publisher: context.publisher,
      agentExecutor: context.agentExecutor,
      conversationManager: context.conversationManager
    });

    context.handled = true;
    return context;
  }


}