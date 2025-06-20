import type { Agent } from "@/types/agent";
import type { ConversationManager } from "@/conversations";
import type { ConversationPublisher } from "@/nostr";
import { initializePhase } from "@/phases";
import { getProjectContext } from "@/runtime";
import type { Phase } from "@/types/conversation";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";
import type { RoutingLLM } from "./RoutingLLM";
import { AgentExecutor } from "@/agents/execution";
import type { LLMService } from "@/llm";

export class ConversationRouter {
  private agentExecutor: AgentExecutor;

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
      const routingDecision = await this.routingLLM.routeNewConversation(event, availableAgents);

      logger.info("Routing decision", {
        conversationId: conversation.id,
        phase: routingDecision.phase,
        confidence: routingDecision.confidence,
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
        await this.transitionPhase(conversation.id, newPhase, availableAgents, event);
        return;
      }

      // Route within current phase
      const routingDecision = await this.routingLLM.routeNextAction(
        conversation,
        event.content || "",
        availableAgents
      );

      // Check if phase should change based on routing decision
      if (routingDecision.phase !== conversation.phase) {
        await this.transitionPhase(
          conversation.id,
          routingDecision.phase,
          availableAgents,
          event
        );
      } else if (conversation.phase === "chat") {
        // In chat phase, the project responds directly to the user
        const projectContext = getProjectContext();
        
        // Execute project response logic
        const executionResult = await this.agentExecutor.execute(
          {
            agent: {
              name: "Project",
              role: "Requirements analyst",
              expertise: "Understanding user needs and clarifying requirements",
              pubkey: projectContext.projectSigner.pubkey,
              signer: projectContext.projectSigner,
              llmConfig: "default",
              tools: [] // Project doesn't need tools in chat phase
            },
            conversation,
            phase: "chat",
            lastUserMessage: event.content
          },
          event
        );

        if (!executionResult.success) {
          logger.error('Project execution failed during chat phase', {
            error: executionResult.error
          });
        }
      } else if (routingDecision.nextAgent) {
        // In non-chat phases, route to specific agents
        await this.conversationManager.updateCurrentAgent(
          conversation.id,
          routingDecision.nextAgent
        );

        // Find the assigned agent
        const agent = availableAgents.find(a => a.pubkey === routingDecision.nextAgent);
        if (agent) {
          // Execute the agent to generate response
          const executionResult = await this.agentExecutor.execute(
            {
              agent,
              conversation,
              phase: conversation.phase,
              lastUserMessage: event.content
            },
            event
          );

          if (!executionResult.success) {
            logger.error('Agent execution failed during reply routing', {
              agent: agent.name,
              error: executionResult.error
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
    const projectContext = getProjectContext();

    if (phase === "chat") {
      // In chat phase, project responds
      await this.publisher.publishProjectResponse(
        triggeringEvent,
        result.message || `Entering ${phase} phase. Let me understand your requirements.`,
        { phase, initialized: true }
      );
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
            projectContext: result.metadata
          },
          triggeringEvent
        );

        if (!executionResult.success) {
          logger.error('Agent execution failed during phase initialization', {
            agent: agent.name,
            phase,
            error: executionResult.error
          });
        }
      }
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
    const projectContext = getProjectContext();
    await this.publisher.publishPhaseTransition(
      conversation,
      newPhase,
      context,
      projectContext.projectSigner,
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
