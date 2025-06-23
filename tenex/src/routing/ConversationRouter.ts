import { AgentExecutor } from "@/agents";
import type { ConversationManager } from "@/conversations";
import type { LLMService } from "../llm/types";
import type { ConversationPublisher, TypingIndicatorPublisher } from "@/nostr";
import { initializePhase } from "@/phases";
import type { Agent } from "@/agents/types";
import type { Phase, Conversation } from "@/conversations/types";
import { handlePhaseInitializationResponse } from "./phase-initialization";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";
import type { RoutingLLM } from "./RoutingLLM";
import { isEventFromUser } from "@/nostr/utils";
import {
  applyBusinessRules,
  validateRoutingDecision,
} from "./routingDomain";
import { 
  RoutingPipeline,
  PhaseTransitionHandler,
  RoutingDecisionHandler,
  ChatPhaseHandler,
  AgentRoutingHandler,
  PhaseTransitionExecutor,
  type RoutingContext
} from "./pipeline";

export class ConversationRouter {
  private agentExecutor: AgentExecutor;
  private replyPipeline: RoutingPipeline;

  constructor(
    private conversationManager: ConversationManager,
    private routingLLM: RoutingLLM,
    private publisher: ConversationPublisher,
    llmService: LLMService,
    private typingIndicatorPublisher?: TypingIndicatorPublisher
  ) {
    this.agentExecutor = new AgentExecutor(llmService, publisher, typingIndicatorPublisher);
    
    // Initialize the routing pipeline
    this.replyPipeline = new RoutingPipeline([
      new PhaseTransitionHandler(),
      new RoutingDecisionHandler(),
      new ChatPhaseHandler(),
      new AgentRoutingHandler(),
      new PhaseTransitionExecutor()
    ]);
  }

  /**
   * Route a new conversation event
   */
  async routeNewConversation(event: NDKEvent, availableAgents: Agent[]): Promise<void> {
    // Log conversation start with human-readable format
    logger.conversationStart(event.content || "", event.id, event.content);

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
        logger.conversationError(
          `Invalid routing decision: ${validation.reason}`,
          { decision: routingDecision },
          conversation.id,
          conversation.title
        );
        // Fallback to chat phase
        routingDecision = {
          phase: "chat",
          reasoning: validation.reason || "Invalid routing decision, defaulting to chat",
          confidence: 0.5,
        };
      }

      // Log routing decision with clear formatting
      logger.routingDecision({
        phase: routingDecision.phase,
        reasoning: routingDecision.reasoning,
        confidence: routingDecision.confidence,
        agent: routingDecision.nextAgent,
      }, conversation.id, conversation.title);

      // Initialize the determined phase
      await this.initializePhase(conversation.id, routingDecision.phase, availableAgents, event);
    } catch (error) {
      logger.conversationError("Failed to route new conversation", { error });
      throw error;
    }
  }

  /**
   * Route a reply within an existing conversation
   */
  async routeReply(event: NDKEvent, availableAgents: Agent[]): Promise<void> {
    try {
      // Find the conversation this reply belongs to
      const conversation = this.conversationManager.getConversationByEvent(
        event.tags.find((tag) => tag[0] === "E")?.[1] || ""
      );

      if (!conversation) {
        logger.conversationError("No conversation found for reply", { eventId: event.id });
        return;
      }

      // Log the message based on its source
      if (isEventFromUser(event)) {
        logger.userMessage(event.content || "", conversation.id, conversation.title, event.id);
      } else {
        logger.info(`Agent message received: ${event.content?.substring(0, 50)}...`, "conversation", "normal");
      }

      // Add event to conversation history
      await this.conversationManager.addEvent(conversation.id, event);

      // Create routing context
      const context: RoutingContext = {
        event,
        conversation,
        availableAgents,
        handled: false,
        conversationManager: this.conversationManager,
        routingLLM: this.routingLLM,
        publisher: this.publisher,
        agentExecutor: this.agentExecutor
      };

      // Execute the pipeline
      const result = await this.replyPipeline.execute(context);

      if (result.error) {
        logger.conversationError("Routing pipeline failed", { 
          error: result.error,
          conversationId: conversation.id 
        }, conversation.id, conversation.title);
        throw result.error;
      }

      if (!result.handled) {
        logger.conversationError("No handler processed the reply", {
          conversationId: conversation.id,
          eventId: event.id
        }, conversation.id, conversation.title);
      }
    } catch (error) {
      logger.conversationError("Failed to route reply", { error });
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

    // Log phase transition
    if (conversation.phase !== phase) {
      logger.phaseTransition(
        conversation.phase, 
        phase, 
        "Initializing new phase based on routing decision",
        conversation.id,
        conversation.title
      );
    }

    // Update conversation phase
    await this.conversationManager.updatePhase(conversationId, phase);

    // Initialize the phase
    const result = await initializePhase(phase, conversation, availableAgents);

    logger.info(`Phase initialized: ${phase} (success: ${result.success}, nextAgent: ${result.nextAgent})`, "conversation", "normal");

    // Update conversation metadata with initialization result
    await this.conversationManager.updateMetadata(conversationId, {
      [`${phase}_init`]: result,
    });

    // Handle phase-specific initialization responses
    await handlePhaseInitializationResponse({
      phase,
      conversation,
      result,
      availableAgents,
      event: triggeringEvent,
      publisher: this.publisher,
      agentExecutor: this.agentExecutor,
      conversationManager: this.conversationManager
    });
  }

}