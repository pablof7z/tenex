import type { LLMService } from "@/llm";
import type { ConversationPublisher } from "@/nostr";
import { getProjectContext } from "@/runtime";
import { ToolExecutionManager } from "@/tools/execution";
import type { Phase } from "@/types/conversation";
import type { LLMMetadata } from "@/types/nostr";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";
import { Message } from "multi-llm-ts";
import {
  buildConversationContext,
  buildFullPrompt,
  buildPhaseContext,
  buildSystemPrompt,
} from "./AgentPromptBuilder";
import type {
  AgentExecutionContext,
  AgentExecutionResult,
  AgentPromptContext,
  ToolExecutionResult,
} from "./types";

export class AgentExecutor {
  private toolManager = new ToolExecutionManager();

  constructor(
    private llmService: LLMService,
    private conversationPublisher: ConversationPublisher
  ) {}

  /**
   * Execute an agent's assignment for a conversation
   */
  async execute(
    context: AgentExecutionContext,
    triggeringEvent: NDKEvent
  ): Promise<AgentExecutionResult> {
    logger.info(`Agent ${context.agent.name} executing for ${context.phase} phase`, {
      conversationId: context.conversation.id,
      agentPubkey: context.agent.pubkey,
    });

    try {
      // 1. Build the agent's prompt
      const promptContext = await this.buildPromptContext(context);

      // 2. Generate response via LLM
      const { response: llmResponse, userPrompt } = await this.generateResponse(
        promptContext,
        context.agent.llmConfig || "default"
      );

      // 3. Process response for tool execution
      const toolContext = {
        projectPath: getProjectContext().projectPath,
        conversationId: context.conversation.id,
        agentName: context.agent.name,
        phase: context.phase,
      };

      const { enhancedResponse, toolResults, invocations } = await this.toolManager.processResponse(
        llmResponse.content,
        toolContext
      );

      // Map tool results to include toolName from invocations
      const mappedToolResults: ToolExecutionResult[] = toolResults.map((result, index) => {
        const invocation = invocations[index];
        return {
          ...result,
          toolName: invocation?.toolName || "unknown",
        };
      });

      // 4. Build metadata
      const llmMetadata = this.llmService.buildMetadata(
        llmResponse,
        promptContext.systemPrompt,
        userPrompt
      );

      // Log enhanced response if it differs from original
      if (enhancedResponse !== llmResponse.content) {
        logger.debug("Agent response enhanced with tool results", {
          agentName: context.agent.name,
          originalLength: llmResponse.content.length,
          enhancedLength: enhancedResponse.length,
          toolCount: toolResults.length,
          enhancedResponse,
        });
      }

      // 5. Determine next responder
      const nextResponder = this.determineNextResponder(context, enhancedResponse);

      // 6. Publish response to Nostr (with enhanced response)
      const publishedEvent = await this.publishResponse(
        context,
        triggeringEvent,
        enhancedResponse,
        nextResponder,
        llmMetadata
      );

      return {
        success: true,
        response: enhancedResponse,
        llmMetadata,
        toolExecutions: mappedToolResults,
        nextAgent: nextResponder,
        publishedEvent,
      };
    } catch (error) {
      logger.error(`Agent execution failed for ${context.agent.name}`, { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Build the complete prompt context for the agent
   */
  private async buildPromptContext(context: AgentExecutionContext): Promise<AgentPromptContext> {
    const systemPrompt = await buildSystemPrompt(context.agent, context.phase);

    const conversationHistory = buildConversationContext(context.conversation);

    const phaseContext = buildPhaseContext(context.conversation, context.phase);

    const constraints = this.getPhaseConstraints(context.phase);

    return {
      systemPrompt,
      conversationHistory,
      phaseContext,
      availableTools: context.agent.tools,
      constraints,
    };
  }

  /**
   * Generate response using LLM
   */
  private async generateResponse(promptContext: AgentPromptContext, llmConfig: string) {
    const userPrompt = buildFullPrompt(promptContext);
    const messages: Message[] = [
      new Message("system", promptContext.systemPrompt),
      new Message("user", userPrompt),
    ];

    logger.debug("Generating agent response", {
      llmConfig,
      messageCount: messages.length,
    });

    const response = await this.llmService.complete(llmConfig, messages);

    logger.info("Agent response generated", {
      model: response.model,
      tokens: response.usage.totalTokens,
      cost: response.cost,
    });

    // Log the actual response content
    logger.debug("Agent response content", {
      agentName: promptContext.availableTools?.[0] || "unknown",
      responseLength: response.content.length,
      response: response.content,
    });

    return { response, userPrompt };
  }

  /**
   * Determine who should respond next
   */
  private determineNextResponder(
    context: AgentExecutionContext,
    response: string
  ): string | undefined {
    // In chat phase, typically the user responds
    if (context.phase === "chat") {
      // Get the user's pubkey from the conversation history
      const firstEvent = context.conversation.history[0];
      // Always return the conversation starter in chat phase
      // This ensures we don't fall back to triggeringEvent.pubkey
      return firstEvent?.pubkey || undefined;
    }

    // In other phases, check if agent is handing off to another agent
    // Agent handoff detection would be implemented here
    
    // Default: no specific next responder
    return undefined;
  }

  /**
   * Publish the agent's response to Nostr
   */
  private async publishResponse(
    context: AgentExecutionContext,
    triggeringEvent: NDKEvent,
    response: string,
    nextResponder?: string,
    llmMetadata?: LLMMetadata
  ): Promise<NDKEvent> {
    // In chat phase, if no next responder is specified, use the conversation starter
    let responder = nextResponder;

    if (!responder && context.phase === "chat") {
      // Get the original conversation starter (human)
      const firstEvent = context.conversation.history[0];
      responder = firstEvent?.pubkey;
    }

    // Only fall back to triggering event pubkey if we have no other option
    // and we're not in chat phase
    if (!responder && context.phase !== "chat") {
      responder = triggeringEvent.pubkey;
    }

    // Ensure we never tag the agent itself (prevent loops)
    if (responder === context.agent.pubkey) {
      logger.warn("Preventing self-tagging in agent response", {
        agent: context.agent.name,
        phase: context.phase,
      });
      responder = undefined;
    }

    const publishedEvent = await this.conversationPublisher.publishAgentResponse(
      triggeringEvent,
      response,
      responder || "", // Empty string means no specific next responder
      context.agent.signer,
      llmMetadata
    );

    logger.info("Agent response published", {
      agent: context.agent.name,
      eventId: publishedEvent.id,
      nextResponder: responder,
    });

    return publishedEvent;
  }

  /**
   * Get phase-specific constraints
   */
  private getPhaseConstraints(phase: Phase): string[] {
    switch (phase) {
      case "chat":
        return [
          "Focus on understanding requirements",
          "Ask one or two clarifying questions at most",
          "Keep responses concise and friendly",
        ];

      case "plan":
        return [
          "Create a structured plan with clear milestones",
          "Include time estimates when possible",
          "Identify potential risks or challenges",
        ];

      case "execute":
        return [
          "Focus on implementation details",
          "Provide code examples when relevant",
          "Explain technical decisions",
        ];

      case "review":
        return [
          "Provide constructive feedback",
          "Highlight both strengths and areas for improvement",
          "Suggest specific improvements",
        ];

      default:
        return [];
    }
  }
}
