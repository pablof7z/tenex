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
  createAgentExecutionContext,
  createChildContext,
  createToolExecutionContext,
  createTracingLogger,
  type TracingContext,
} from "@/tracing";
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
    triggeringEvent: NDKEvent,
    parentTracingContext?: TracingContext
  ): Promise<AgentExecutionResult> {
    // Create agent execution tracing context
    const tracingContext = parentTracingContext
      ? createAgentExecutionContext(parentTracingContext, context.agent.name)
      : createAgentExecutionContext(
          { conversationId: context.conversation.id, executionId: "root", startTime: Date.now() },
          context.agent.name
        );

    const tracingLogger = createTracingLogger(tracingContext, "agent");
    
    tracingLogger.startOperation("agent_execution", {
      agentName: context.agent.name,
      agentPubkey: context.agent.pubkey,
      phase: context.phase,
    });

    try {
      // 1. Build the agent's prompt
      const promptContext = await this.buildPromptContext(context);

      // 2. Generate initial response via LLM
      const llmStartTime = Date.now();
      tracingLogger.logLLMRequest(context.agent.llmConfig || "default");
      
      const { response: initialResponse, userPrompt } = await this.generateResponse(
        promptContext,
        context.agent.llmConfig || "default"
      );
      
      const llmDuration = Date.now() - llmStartTime;
      tracingLogger.logLLMResponse(
        context.agent.llmConfig || "default",
        llmDuration,
        initialResponse.usage?.prompt_tokens,
        initialResponse.usage?.completion_tokens
      );

      // 3. Execute the Reason-Act loop
      const reasonActResult = await this.executeReasonActLoop(
        initialResponse,
        context,
        promptContext.systemPrompt,
        userPrompt,
        tracingContext
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
        llmMetadata,
        tracingContext
      );

      tracingLogger.completeOperation("agent_execution", {
        agentName: context.agent.name,
        responseLength: reasonActResult.finalContent.length,
        toolExecutions: reasonActResult.allToolResults.length,
        nextAgent: nextResponder,
      });

      return {
        success: true,
        response: reasonActResult.finalContent,
        llmMetadata,
        toolExecutions: reasonActResult.allToolResults,
        nextAgent: nextResponder,
        publishedEvent,
      };
    } catch (error) {
      tracingLogger.failOperation("agent_execution", error, {
        agentName: context.agent.name,
      });
      
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
    const projectConfig = await getProjectContext();

    const conversationContext = buildConversationContext(context.conversation);
    const phaseContext = buildPhaseContext(context);
    const systemPrompt = buildSystemPrompt(context, projectConfig);

    return {
      systemPrompt,
      conversationContext,
      phaseContext,
    };
  }

  /**
   * Generate initial response from LLM
   */
  private async generateResponse(
    promptContext: AgentPromptContext,
    llmConfig: string
  ): Promise<{ response: any; userPrompt: string }> {
    const messages = buildFullPrompt(promptContext);
    const userPrompt = messages.find((m) => m.role === "user")?.content || "";

    const response = await this.llmService.complete(messages, llmConfig);
    return { response, userPrompt };
  }

  /**
   * Execute the Reason-Act loop for tool usage
   */
  private async executeReasonActLoop(
    initialResponse: any,
    context: AgentExecutionContext,
    systemPrompt: string,
    userPrompt: string,
    tracingContext: TracingContext
  ): Promise<{
    finalResponse: any;
    finalContent: string;
    allToolResults: ToolExecutionResult[];
  }> {
    const tracingLogger = createTracingLogger(tracingContext, "agent");
    let currentResponse = initialResponse;
    let finalContent = currentResponse.content;
    const allToolResults: ToolExecutionResult[] = [];

    // Check if the response contains tool calls
    const toolCalls = this.extractToolCalls(currentResponse);

    if (toolCalls.length > 0) {
      tracingLogger.info("Agent requested tool usage", {
        toolCount: toolCalls.length,
        tools: toolCalls.map(tc => tc.name),
      });

      // Execute tools
      for (const toolCall of toolCalls) {
        const toolContext = createToolExecutionContext(tracingContext, toolCall.name);
        const toolLogger = createTracingLogger(toolContext, "tools");
        
        toolLogger.startOperation("tool_execution", {
          tool: toolCall.name,
        });
        
        const toolResults = await this.toolManager.executeToolsIfRequested(
          context.agent,
          currentResponse.content
        );
        
        toolLogger.completeOperation("tool_execution", {
          tool: toolCall.name,
          resultCount: toolResults.length,
        });
        
        allToolResults.push(...toolResults);
      }

      // Continue conversation with tool results
      if (allToolResults.length > 0) {
        const toolResultsMessage = this.formatToolResults(allToolResults);
        const messages = [
          new Message("system", systemPrompt),
          new Message("user", userPrompt),
          new Message("assistant", currentResponse.content),
          new Message("user", toolResultsMessage),
        ];

        tracingLogger.logLLMRequest(context.agent.llmConfig || "default");
        const llmStartTime = Date.now();
        
        const continuationResponse = await this.llmService.complete(
          messages,
          context.agent.llmConfig || "default"
        );
        
        const llmDuration = Date.now() - llmStartTime;
        tracingLogger.logLLMResponse(
          context.agent.llmConfig || "default",
          llmDuration,
          continuationResponse.usage?.prompt_tokens,
          continuationResponse.usage?.completion_tokens
        );

        currentResponse = continuationResponse;
        finalContent = continuationResponse.content;
      }
    }

    return {
      finalResponse: currentResponse,
      finalContent,
      allToolResults,
    };
  }

  /**
   * Extract tool calls from LLM response
   */
  private extractToolCalls(response: any): Array<{ name: string; args: any }> {
    // This is a simplified version - actual implementation would parse
    // the response format used by your LLM
    return [];
  }

  /**
   * Format tool results for continuation
   */
  private formatToolResults(results: ToolExecutionResult[]): string {
    return results
      .map((result) => {
        return `Tool: ${result.tool}\nResult: ${result.result}`;
      })
      .join("\n\n");
  }

  /**
   * Determine who should respond next
   */
  private determineNextResponder(
    context: AgentExecutionContext,
    response: string
  ): string | undefined {
    // Check if response indicates phase transition
    if (response.includes("PHASE_TRANSITION:")) {
      return undefined; // Router will handle
    }

    // Check if response indicates specific agent handoff
    const handoffMatch = response.match(/HANDOFF_TO:\s*(\S+)/);
    if (handoffMatch) {
      return handoffMatch[1];
    }

    // Default: continue with user
    return undefined;
  }

  /**
   * Publish the agent's response to Nostr
   */
  private async publishResponse(
    context: AgentExecutionContext,
    triggeringEvent: NDKEvent,
    content: string,
    nextResponder: string | undefined,
    llmMetadata?: LLMMetadata,
    tracingContext?: TracingContext
  ): Promise<NDKEvent> {
    const tracingLogger = tracingContext 
      ? createTracingLogger(tracingContext, "nostr")
      : logger.forModule("nostr");

    const event = await this.conversationPublisher.publishAgentResponse(
      context.conversation.id,
      content,
      context.agent.pubkey,
      nextResponder,
      triggeringEvent,
      llmMetadata
    );

    if (tracingContext) {
      tracingLogger.logEventPublished(event.id || "unknown", "agent_response", {
        agentName: context.agent.name,
        nextResponder,
        hasLLMMetadata: !!llmMetadata,
      });
    }

    return event;
  }
}