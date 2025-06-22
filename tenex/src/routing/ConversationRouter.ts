import { AgentExecutor, createMinimalProjectAgent, createProjectAgent } from "@/agents";
import type { ConversationManager } from "@/conversations";
import type { ConversationState } from "@/conversations/types";
import type { LLMService } from "@/core/llm/types";
import type { ConversationPublisher } from "@/nostr";
import { initializePhase } from "@/phases";
import { projectContext } from "@/services";
import type { Agent } from "@/agents/types";
import type { Phase, Conversation } from "@/conversations/types";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";
import type { RoutingLLM } from "./RoutingLLM";
import {
  applyBusinessRules,
  canTransitionPhase,
  getDefaultAgentForPhase,
  meetsPhaseTransitionCriteria,
  validateRoutingDecision,
} from "./routingDomain";

export class ConversationRouter {
  private agentExecutor: AgentExecutor;

  /**
   * Convert ConversationState to Conversation for type compatibility
   */
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

  constructor(
    private conversationManager: ConversationManager,
    private routingLLM: RoutingLLM,
    private publisher: ConversationPublisher,
    llmService: LLMService
  ) {
    this.agentExecutor = new AgentExecutor(llmService, publisher);
  }

  /**
   * Route a new conversation event
   */
  async routeNewConversation(event: NDKEvent, availableAgents: Agent[]): Promise<void> {
    logger.info("Routing new conversation", {
      eventId: event.id,
      content: event.content?.substring(0, 100),
    });

    try {
      // Create conversation
      const conversation = await this.conversationManager.createConversation(event);

      // Get routing decision
      let routingDecision = await this.routingLLM.routeNewConversation(event, availableAgents);

      // Apply business rules to enhance the decision
      routingDecision = applyBusinessRules(routingDecision, conversation, availableAgents);

      // Validate the routing decision
      const validation = validateRoutingDecision(routingDecision, conversation, availableAgents);

      if (!validation.valid) {
        logger.warn("Invalid routing decision", {
          reason: validation.reason,
          decision: routingDecision,
        });
        // Fallback to chat phase
        routingDecision = {
          phase: "chat",
          reasoning: validation.reason || "Invalid routing decision, defaulting to chat",
          confidence: 0.5,
        };
      }

      logger.info("Routing decision", {
        conversationId: conversation.id,
        phase: routingDecision.phase,
        confidence: routingDecision.confidence,
        enhanced: true,
      });

      // Initialize the determined phase
      await this.initializePhase(conversation.id, routingDecision.phase, availableAgents, event);
    } catch (error) {
      logger.error("Failed to route new conversation", { error });
      throw error;
    }
  }

  /**
   * Route a reply within an existing conversation
   */
  async routeReply(event: NDKEvent, availableAgents: Agent[]): Promise<void> {
    logger.info("Routing reply", { eventId: event.id });

    try {
      // Find the conversation this reply belongs to
      const conversation = this.conversationManager.getConversationByEvent(
        event.tags.find((tag) => tag[0] === "E")?.[1] || ""
      );

      if (!conversation) {
        logger.error("No conversation found for reply");
        return;
      }

      // Add event to conversation history
      await this.conversationManager.addEvent(conversation.id, event);

      // Check if this is a phase transition request
      const phaseTag = event.tags.find((tag) => tag[0] === "phase");
      if (phaseTag) {
        const newPhase = phaseTag[1] as Phase;

        // Validate the requested phase transition
        if (canTransitionPhase(conversation.phase, newPhase)) {
          const transitionCheck = meetsPhaseTransitionCriteria(conversation, newPhase);

          if (transitionCheck.canTransition) {
            await this.transitionPhase(conversation.id, newPhase, availableAgents, event);
          } else {
            logger.warn("Phase transition criteria not met", {
              from: conversation.phase,
              to: newPhase,
              reason: transitionCheck.reason,
            });
            // Publish feedback to user
            await this.publisher.publishProjectResponse(
              event,
              `Cannot transition to ${newPhase} phase: ${transitionCheck.reason}`,
              { phase: conversation.phase, error: true }
            );
          }
        } else {
          logger.warn("Invalid phase transition requested", {
            from: conversation.phase,
            to: newPhase,
          });
          // Publish feedback to user
          await this.publisher.publishProjectResponse(
            event,
            `Cannot transition from ${conversation.phase} to ${newPhase} phase directly.`,
            { phase: conversation.phase, error: true }
          );
        }
        return;
      }

      // Route within current phase
      let routingDecision = await this.routingLLM.routeNextAction(
        this.convertToConversation(conversation),
        event.content || "",
        availableAgents
      );

      // Apply business rules
      routingDecision = applyBusinessRules(routingDecision, conversation, availableAgents);

      // Check if phase should change based on routing decision
      if (routingDecision.phase !== conversation.phase) {
        // Validate phase transition
        const transitionCheck = meetsPhaseTransitionCriteria(conversation, routingDecision.phase);

        if (!transitionCheck.canTransition) {
          logger.warn("Phase transition blocked", {
            from: conversation.phase,
            to: routingDecision.phase,
            reason: transitionCheck.reason,
          });
          // Stay in current phase
          routingDecision.phase = conversation.phase;
        } else {
          await this.transitionPhase(
            conversation.id,
            routingDecision.phase,
            availableAgents,
            event
          );
        }
      } else if (conversation.phase === "chat") {
        // In chat phase, the project responds directly to the user
        const currentProject = projectContext.getCurrentProject();

        // Execute project response logic
        const projectAgent = createProjectAgent();
        const executionResult = await this.agentExecutor.execute(
          {
            agent: projectAgent,
            conversation,
            phase: "chat",
            lastUserMessage: event.content,
          },
          event
        );

        if (!executionResult.success) {
          logger.error("Project execution failed during chat phase", {
            error: executionResult.error,
          });
        }
      } else if (routingDecision.nextAgent) {
        // In non-chat phases, route to specific agents
        await this.conversationManager.updateCurrentAgent(
          conversation.id,
          routingDecision.nextAgent
        );

        // Find the assigned agent
        let agent = availableAgents.find((a) => a.pubkey === routingDecision.nextAgent);

        // If agent not found, try to assign a default one
        if (!agent) {
          agent = getDefaultAgentForPhase(conversation.phase, availableAgents) || undefined;
          if (agent) {
            logger.info("Assigned default agent for phase", {
              phase: conversation.phase,
              agent: agent.name,
            });
            await this.conversationManager.updateCurrentAgent(conversation.id, agent.pubkey);
          }
        }

        if (agent) {
          // Execute the agent to generate response
          const executionResult = await this.agentExecutor.execute(
            {
              agent,
              conversation,
              phase: conversation.phase,
              lastUserMessage: event.content,
            },
            event
          );

          if (!executionResult.success) {
            logger.error("Agent execution failed during reply routing", {
              agent: agent.name,
              error: executionResult.error,
            });
          }
        }
      }
    } catch (error) {
      logger.error("Failed to route reply", { error });
      throw error;
    }
  }

  /**
   * Initialize a phase using the appropriate phase initializer
   */
  private async initializePhase(
    conversationId: string,
    phase: Phase,
    availableAgents: Agent[],
    triggeringEvent: NDKEvent
  ): Promise<void> {
    const conversation = this.conversationManager.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Update conversation phase
    await this.conversationManager.updatePhase(conversationId, phase);

    // Initialize the phase
    const result = await initializePhase(phase, conversation, availableAgents);

    logger.info("Phase initialized", {
      conversationId,
      phase,
      success: result.success,
      nextAgent: result.nextAgent,
    });

    // Update conversation metadata with initialization result
    await this.conversationManager.updateMetadata(conversationId, {
      [`${phase}_init`]: result,
    });

    // Publish phase initialization response
    const currentProject = projectContext.getCurrentProject();

    if (phase === "chat") {
      // In chat phase, project responds using LLM
      const projectAgent = createProjectAgent();

      // Execute using the agent executor to generate an actual response
      const executionResult = await this.agentExecutor.execute(
        {
          agent: projectAgent,
          conversation,
          phase,
          lastUserMessage: triggeringEvent.content,
        },
        triggeringEvent
      );

      if (!executionResult.success) {
        logger.error("Project chat execution failed", {
          error: executionResult.error,
        });
        // Fallback to a generic message if execution fails
        await this.publisher.publishProjectResponse(
          triggeringEvent,
          "I'm having trouble processing your request. Could you please rephrase it?",
          { phase, error: true }
        );
      }
    } else if (result.nextAgent) {
      // In other phases, assigned agent responds
      const agent = availableAgents.find((a) => a.pubkey === result.nextAgent);
      if (agent) {
        await this.conversationManager.updateCurrentAgent(conversationId, agent.pubkey);

        // Execute the agent to generate their initial response
        const executionResult = await this.agentExecutor.execute(
          {
            agent,
            conversation,
            phase,
            projectContext: result.metadata,
          },
          triggeringEvent
        );

        if (!executionResult.success) {
          logger.error("Agent execution failed during phase initialization", {
            agent: agent.name,
            phase,
            error: executionResult.error,
          });
        }
      }
    } else if (phase === "plan" && result.metadata?.claudeCodeTriggered) {
      // Plan phase with Claude Code - just publish a status message
      await this.publisher.publishProjectResponse(
        triggeringEvent,
        result.message || "Claude Code is working on the implementation plan.",
        { phase, claudeCodeActive: true }
      );
    }
  }

  /**
   * Transition to a new phase
   */
  private async transitionPhase(
    conversationId: string,
    newPhase: Phase,
    availableAgents: Agent[],
    triggeringEvent: NDKEvent
  ): Promise<void> {
    const conversation = this.conversationManager.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const oldPhase = conversation.phase;

    // Compact conversation history for the new phase
    const context = await this.conversationManager.compactHistory(conversationId, newPhase);

    // Publish phase transition event
    const projectNsec = projectContext.getCurrentProjectNsec();
    const projectSigner = new NDKPrivateKeySigner(projectNsec);
    await this.publisher.publishPhaseTransition(
      this.convertToConversation(conversation),
      newPhase,
      context,
      projectSigner,
      triggeringEvent
    );

    // Initialize the new phase
    await this.initializePhase(conversationId, newPhase, availableAgents, triggeringEvent);

    logger.info("Phase transition complete", {
      conversationId,
      from: oldPhase,
      to: newPhase,
    });
  }
}
