import type { ConversationManager } from "@/conversations/ConversationManager";
import { DEFAULT_AGENT_LLM_CONFIG } from "@/llm/constants";
import type { LLMService, StreamEvent, Tool } from "@/llm/types";
import { NostrPublisher } from "@/nostr";
import type { LLMMetadata } from "@/nostr/types";
import { buildLLMMetadata } from "@/prompts/utils/llmMetadata";
import {
  buildHistoryMessages,
  getLatestUserMessage,
  needsCurrentUserMessage,
} from "@/prompts/utils/messageBuilder";
import { buildSystemPrompt } from "@/prompts/utils/systemPromptBuilder";
import { type ProjectContext, getProjectContext } from "@/services";
import { mcpService } from "@/services/mcp/MCPService";
import type { ContinueFlow, EndConversation, YieldBack } from "@/tools/types";
import {
  type TracingContext,
  createAgentExecutionContext,
  createTracingContext,
  createTracingLogger,
} from "@/tracing";
import { logger } from "@/utils/logger";
import type NDK from "@nostr-dev-kit/ndk";
import type { NDKEvent, NDKTag } from "@nostr-dev-kit/ndk";
import { Message } from "multi-llm-ts";
import { ReasonActLoop } from "./ReasonActLoop";
import type { ReasonActContext, ReasonActResult } from "./ReasonActLoop";
import type {
  AgentExecutionContext,
  AgentExecutionContextWithHandoff,
  AgentExecutionResult,
} from "./types";
import "@/prompts/fragments/available-agents";
import "@/prompts/fragments/orchestrator-routing";
import "@/prompts/fragments/expertise-boundaries";
import { startExecutionTime, stopExecutionTime } from "@/conversations/executionTime";

export class AgentExecutor {
  private reasonActLoop: ReasonActLoop;

  constructor(
    private llmService: LLMService,
    private ndk: NDK,
    private conversationManager?: ConversationManager
  ) {
    this.reasonActLoop = new ReasonActLoop(llmService, conversationManager);
  }

  /**
   * Execute an agent's assignment for a conversation with streaming
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
          createTracingContext(context.conversation.id),
          context.agent.name
        );

    const tracingLogger = createTracingLogger(tracingContext, "agent");

    tracingLogger.startOperation("agent_execution", {
      phase: context.phase,
    });

    // Create NostrPublisher outside try block so it's accessible in catch
    const publisher = new NostrPublisher({
      conversation: context.conversation,
      agent: context.agent,
      triggeringEvent: triggeringEvent,
      conversationManager: this.conversationManager,
    });

    try {
      // Start execution time tracking
      startExecutionTime(context.conversation);

      // 1. Build the agent's messages
      const messages = await this.buildMessages(context, triggeringEvent);

      // 2. Publish typing indicator start
      await publisher.publishTypingIndicator("start");

      // Get tools for response processing - use agent's configured tools
      const tools = context.agent.tools || [];

      // Add MCP tools if available and agent has MCP access
      let allTools = tools;
      if (context.agent.mcp !== false) {
        const mcpTools = await mcpService.getAvailableTools();
        allTools = [...tools, ...mcpTools];
      }

      const streamResult = await this.executeWithStreaming(
        {
          projectPath: process.cwd(),
          conversationId: context.conversation.id,
          phase: context.phase,
          llmConfig: context.agent.llmConfig || DEFAULT_AGENT_LLM_CONFIG,
          agent: context.agent,
          conversation: context.conversation,
          eventToReply: triggeringEvent,
        },
        messages,
        tracingContext,
        allTools,
        publisher
      );

      const finalResponse = streamResult.finalResponse;
      const finalContent = streamResult.finalContent;
      const allToolResults = streamResult.allToolResults || [];
      const continueFlow = streamResult.continueFlow;
      const termination = streamResult.termination;

      // Build metadata with final response from ReasonActLoop
      const llmMetadata = await buildLLMMetadata(finalResponse, messages);

      // Add the agent's response to their context
      if (this.conversationManager && finalContent) {
        await this.conversationManager.addMessageToContext(
          context.conversation.id,
          context.agent.slug,
          new Message("assistant", finalContent)
        );
      }

      // 8. Check if response was already published
      let publishedEvent: NDKEvent | undefined;
      
      // Routing tools (continue, yield_back, end_conversation) publish directly
      const isRoutingTool = !!(continueFlow || termination);
      
      if (streamResult.wasPublished || isRoutingTool) {
        tracingLogger.debug("Response already published", {
          agentName: context.agent.name,
          reason: isRoutingTool ? "routing tool published directly" : "published during streaming",
          hasRoutingFlow: !!continueFlow,
          hasTermination: !!termination,
        });
        // We don't have the actual event ID from streaming, but we know it was published
        publishedEvent = undefined;
      } else {
        // Safety fallback for unexpected cases
        tracingLogger.error("Response was not published - publishing now", {
          agentName: context.agent.name,
        });
        publishedEvent = await this.publishResponse(
          context,
          triggeringEvent,
          finalContent,
          continueFlow,
          termination,
          llmMetadata,
          tracingContext
        );
      }

      // Log the agent response in human-readable format
      logger.agentResponse(
        context.agent.name,
        finalContent,
        context.conversation.id,
        context.conversation.title,
        publishedEvent?.id || "streaming-published"
      );

      // 9. Publish typing indicator stop
      await publisher.publishTypingIndicator("stop");

      // Stop execution time tracking
      const sessionDuration = stopExecutionTime(context.conversation);

      // Save updated conversation with execution time
      if (this.conversationManager) {
        await this.conversationManager.saveConversation(context.conversation.id);
      }

      tracingLogger.completeOperation("agent_execution", {
        agentName: context.agent.name,
        responseLength: finalContent.length,
        toolExecutions: allToolResults.length,
        sessionDurationMs: sessionDuration,
      });

      return {
        success: true,
        response: finalContent,
        llmMetadata,
        toolExecutions: allToolResults,
        publishedEvent,
      };
    } catch (error) {
      // Stop execution time tracking even on error
      stopExecutionTime(context.conversation);

      // Save updated conversation with execution time
      if (this.conversationManager) {
        await this.conversationManager.saveConversation(context.conversation.id);
      }

      // Ensure typing indicator is stopped even on error
      await publisher.publishTypingIndicator("stop");

      tracingLogger.failOperation("agent_execution", error, {
        agentName: context.agent.name,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        response: `Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Build the messages array for the agent execution
   */
  private async buildMessages(
    context: AgentExecutionContext,
    triggeringEvent: NDKEvent
  ): Promise<Message[]> {
    const projectCtx = getProjectContext();
    const project = projectCtx.project;

    // Create tag map for efficient lookup
    const tagMap = new Map<string, string>();
    for (const tag of project.tags) {
      if (tag.length >= 2 && tag[0] && tag[1]) {
        tagMap.set(tag[0], tag[1]);
      }
    }

    // No need to load inventory or context files here anymore
    // The fragment handles this internally

    // Get all available agents for handoffs
    const availableAgents = Array.from(projectCtx.agents.values());

    const messages: Message[] = [];

    // Get MCP tools for the prompt
    const mcpTools = await mcpService.getAvailableTools();

    // Build system prompt using the shared function
    const systemPrompt = buildSystemPrompt({
      agent: context.agent,
      phase: context.phase,
      projectTitle: tagMap.get("title") || "Untitled Project",
      projectRepository: tagMap.get("repo"),
      availableAgents,
      conversation: context.conversation,
      agentLessons: projectCtx.agentLessons,
      mcpTools,
      claudeCodeReport: context.additionalContext?.claudeCodeReport,
    });

    messages.push(new Message("system", systemPrompt));

    // Use agent's isolated context instead of full history
    if (this.conversationManager) {
      let agentContext = this.conversationManager.getAgentContext(
        context.conversation.id,
        context.agent.slug
      );

      // If no context exists, this agent is being invoked for the first time
      if (!agentContext) {
        // Check if this is a handoff from another agent (will be set in execute method)
        const handoff = (context as AgentExecutionContextWithHandoff).handoff;

        if (handoff) {
          logger.info("[AGENT_EXECUTOR] Creating context from handoff", {
            fromAgent: handoff.agentName,
            toAgent: context.agent.slug,
            handoffMessage: `${handoff.message.substring(0, 100)}...`,
          });

          // Create context with handoff information
          agentContext = this.conversationManager.createAgentContext(
            context.conversation.id,
            context.agent.slug,
            handoff
          );
        } else {
          logger.info("[AGENT_EXECUTOR] Bootstrapping context for direct invocation", {
            agentSlug: context.agent.slug,
          });

          // Bootstrap context for direct invocation (e.g., p-tag mention)
          agentContext = await this.conversationManager.bootstrapAgentContext(
            context.conversation.id,
            context.agent.slug,
            triggeringEvent
          );
        }
      } else {
        // Context exists - synchronize with missed messages
        logger.info("[AGENT_EXECUTOR] Synchronizing existing context", {
          agentSlug: context.agent.slug,
          currentMessages: agentContext.messages.length,
        });

        await this.conversationManager.synchronizeAgentContext(
          context.conversation.id,
          context.agent.slug,
          triggeringEvent
        );
      }

      // Add the agent's isolated messages
      messages.push(...agentContext.messages);

      logger.info("[AGENT_EXECUTOR] Final message state for agent", {
        agentSlug: context.agent.slug,
        totalMessages: messages.length,
        messages: messages.map((m) => ({
          role: m.role,
          contentPreview: `${m.content.substring(0, 100)}...`,
        })),
      });
    } else {
      // Build messages from conversation history
      const historyMessages = buildHistoryMessages(context.conversation.history);
      messages.push(...historyMessages);

      // Add current user message if needed
      if (needsCurrentUserMessage(context.conversation)) {
        const latestUserMessage = getLatestUserMessage(context.conversation);
        if (latestUserMessage) {
          messages.push(new Message("user", latestUserMessage));
        }
      }
    }

    return messages;
  }

  /**
   * Publish the agent's response to Nostr
   */
  private async publishResponse(
    context: AgentExecutionContext,
    triggeringEvent: NDKEvent,
    content: string,
    continueFlow?: ContinueFlow,
    termination?: YieldBack | EndConversation,
    llmMetadata?: LLMMetadata,
    tracingContext?: TracingContext
  ): Promise<NDKEvent> {
    const additionalTags: NDKTag[] = [];

    // This method is now only used as a fallback - should not normally be called
    const publisher = new NostrPublisher({
      conversation: context.conversation,
      agent: context.agent,
      triggeringEvent: triggeringEvent,
    });

    const event = await publisher.publishResponse({
      content,
      continueMetadata: continueFlow,
      completeMetadata: termination,
      llmMetadata,
      additionalTags,
    });

    return event;
  }

  /**
   * Execute with streaming support
   */
  private async executeWithStreaming(
    context: ReasonActContext,
    messages: Message[],
    tracingContext: TracingContext,
    tools?: Tool[],
    publisher?: NostrPublisher
  ): Promise<ReasonActResult> {
    const tracingLogger = createTracingLogger(tracingContext, "agent");

    // Process the stream - ReasonActLoop handles all publishing
    const stream = this.reasonActLoop.executeStreaming(
      context,
      messages,
      tracingContext,
      publisher,
      tools
    );

    // Drain the generator to make it execute.
    // The generator's return value contains the final result.
    let iterResult: IteratorResult<StreamEvent, ReasonActResult>;
    do {
      iterResult = await stream.next();
      // All yielded events are handled by ReasonActLoop (e.g., streaming and publishing content).
      // AgentExecutor only needs the final result.
    } while (!iterResult.done);

    tracingLogger.info("[AGENT_EXECUTOR] Stream completed", {
      agent: context.agent.name,
      hasTermination: !!iterResult.value.termination,
      hasContinueFlow: !!iterResult.value.continueFlow,
      contentLength: iterResult.value.finalContent.length,
    });

    return iterResult.value;
  }
}
