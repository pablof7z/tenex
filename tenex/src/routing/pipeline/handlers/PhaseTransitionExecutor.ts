import type { MessageHandler, RoutingContext } from "../types";
import type { Phase, Conversation, ConversationState } from "@/conversations/types";
import { initializePhase } from "@/phases";
import { projectContext } from "@/services";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
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
      this.convertToConversation(conversation),
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
    await this.handlePhaseInitialization(
      context,
      newPhase,
      result,
      availableAgents
    );

    context.handled = true;
    return context;
  }

  private async handlePhaseInitialization(
    context: RoutingContext,
    phase: Phase,
    result: any,
    availableAgents: Agent[]
  ): Promise<void> {
    const { conversation, event } = context;

    if (phase === "chat") {
      // In chat phase, project responds using LLM
      const projectAgent = createProjectAgent();

      const executionResult = await context.agentExecutor.execute(
        {
          agent: projectAgent,
          conversation,
          phase,
          lastUserMessage: event.content,
        },
        event
      );

      if (!executionResult.success) {
        logger.error("Project chat execution failed", {
          error: executionResult.error
        });
        // Fallback to a generic message if execution fails
        await context.publisher.publishProjectResponse(
          event,
          "I'm having trouble processing your request. Could you please rephrase it?",
          { phase, error: true }
        );
      }
    } else if (result.nextAgent) {
      // In other phases, assigned agent responds
      const agent = availableAgents.find(a => a.pubkey === result.nextAgent);
      if (agent) {
        await context.conversationManager.updateCurrentAgent(conversation.id, agent.pubkey);

        const executionResult = await context.agentExecutor.execute(
          {
            agent,
            conversation,
            phase,
            projectContext: result.metadata,
          },
          event
        );

        if (!executionResult.success) {
          logger.error("Agent execution failed during phase initialization", {
            agent: agent.name,
            phase,
            error: executionResult.error
          });
        }
      }
    } else if (phase === "plan" && result.metadata?.claudeCodeTriggered) {
      // Plan phase with Claude Code - just publish a status message
      await context.publisher.publishProjectResponse(
        event,
        result.message || "Claude Code is working on the implementation plan.",
        { phase, claudeCodeActive: true }
      );
    }
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

import { createProjectAgent } from "@/agents";
import type { Agent } from "@/agents/types";