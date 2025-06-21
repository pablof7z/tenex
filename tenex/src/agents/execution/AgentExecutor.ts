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

      // 2. Generate initial response via LLM
      const { response: initialResponse, userPrompt } = await this.generateResponse(
        promptContext,
        context.agent.llmConfig || "default"
      );

      // 3. Execute the Reason-Act loop
      const reasonActResult = await this.executeReasonActLoop(
        initialResponse,
        context,
        promptContext.systemPrompt,
        userPrompt
      );

      // 4. Build metadata with final response
      const llmMetadata = this.llmService.buildMetadata(
        reasonActResult.finalResponse,
        promptContext.systemPrompt,
        userPrompt
      );

      // 5. Determine next responder
      const nextResponder = this.determineNextResponder(context, reasonActResult.finalContent);

      // 6. Publish response to Nostr
      const publishedEvent = await this.publishResponse(
        context,
        triggeringEvent,
        reasonActResult.finalContent,
        nextResponder,
        llmMetadata
      );

      return {
        success: true,
        response: reasonActResult.finalContent,
        llmMetadata,
        toolExecutions: reasonActResult.allToolResults,
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
   * Execute the Reason-Act loop for tool-augmented responses
   */
  private async executeReasonActLoop(
    initialResponse: any,
    context: AgentExecutionContext,
    systemPrompt: string,
    originalUserPrompt: string
  ): Promise<{
    finalResponse: any;
    finalContent: string;
    allToolResults: ToolExecutionResult[];
  }> {
    const maxIterations = 3; // Prevent infinite loops
    let currentResponse = initialResponse;
    let allToolResults: ToolExecutionResult[] = [];
    let iteration = 0;

    const toolContext = {
      projectPath: getProjectContext().projectPath,
      conversationId: context.conversation.id,
      agentName: context.agent.name,
      phase: context.phase,
    };

    while (iteration < maxIterations) {
      // Process response for tool invocations
      const { enhancedResponse, toolResults, invocations } = await this.toolManager.processResponse(
        currentResponse.content,
        toolContext
      );

      // Map tool results
      const mappedResults: ToolExecutionResult[] = toolResults.map((result, index) => {
        const invocation = invocations[index];
        return {
          ...result,
          toolName: invocation?.toolName || "unknown",
        };
      });

      allToolResults.push(...mappedResults);

      // If no tools were invoked, we're done
      if (invocations.length === 0) {
        logger.debug("No tool invocations found, completing Reason-Act loop", {
          agent: context.agent.name,
          iteration,
        });
        return {
          finalResponse: currentResponse,
          finalContent: currentResponse.content,
          allToolResults,
        };
      }

      // If tools were invoked, send results back to LLM for reasoning
      logger.info("Tool invocations completed, continuing Reason-Act loop", {
        agent: context.agent.name,
        iteration,
        toolCount: invocations.length,
      });

      // Build continuation prompt with tool results
      const continuationPrompt = this.buildContinuationPrompt(
        originalUserPrompt,
        enhancedResponse,
        mappedResults
      );

      // Generate next response
      const messages: Message[] = [
        new Message("system", systemPrompt),
        new Message("user", originalUserPrompt),
        new Message("assistant", currentResponse.content),
        new Message("user", continuationPrompt),
      ];

      currentResponse = await this.llmService.complete(
        context.agent.llmConfig || "default",
        messages
      );

      iteration++;
    }

    // Max iterations reached
    logger.warn("Reason-Act loop reached maximum iterations", {
      agent: context.agent.name,
      iterations: maxIterations,
    });

    return {
      finalResponse: currentResponse,
      finalContent: currentResponse.content,
      allToolResults,
    };
  }

  /**
   * Build continuation prompt with tool results
   */
  private buildContinuationPrompt(
    originalPrompt: string,
    enhancedResponse: string,
    toolResults: ToolExecutionResult[]
  ): string {
    let prompt = "Based on the tool execution results:\n\n";

    for (const result of toolResults) {
      prompt += `**${result.toolName}**: `;
      if (result.success) {
        prompt += typeof result.output === "string" 
          ? result.output 
          : JSON.stringify(result.output, null, 2);
      } else {
        prompt += `Error: ${result.error}`;
      }
      prompt += "\n\n";
    }

    prompt += "\nPlease continue with your analysis or provide a final response. ";
    prompt += "If you need to use more tools, you can do so. ";
    prompt += "If you have all the information needed, provide your complete response.";

    return prompt;
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
