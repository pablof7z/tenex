import type { ConversationManager } from "@/conversations/ConversationManager";
import type { Phase } from "@/conversations/phases";
import type { PhaseTransition } from "@/conversations/types";
import { DEFAULT_AGENT_LLM_CONFIG } from "@/llm/constants";
import type { CompletionResponse, LLMService, StreamEvent, Tool } from "@/llm/types";
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
import { getTool } from "@/tools/registry";
import type {
  ContinueMetadata,
  EndConversationMetadata,
  ToolExecutionMetadata,
  ToolExecutionResult,
  ToolOutput,
  ToolResult,
  YieldBackMetadata,
} from "@/tools/types";
import { isContinueMetadata, isEndConversationMetadata, isYieldBackMetadata } from "@/tools/types";
import {
  type TracingContext,
  type TracingLogger,
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
import type { AgentExecutionContext, AgentExecutionResult } from "./types";
import "@/prompts/fragments/available-agents";
import "@/prompts/fragments/orchestrator-routing";
import "@/prompts/fragments/expertise-boundaries";
import { startExecutionTime, stopExecutionTime } from "@/conversations/executionTime";

export class AgentExecutor {
  private reasonActLoop: ReasonActLoop;
  private projectCtx: ProjectContext;

  constructor(
    private llmService: LLMService,
    private ndk: NDK,
    private conversationManager?: ConversationManager
  ) {
    this.reasonActLoop = new ReasonActLoop(llmService);
    this.projectCtx = getProjectContext();
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
    });

    try {
      // Start execution time tracking
      startExecutionTime(context.conversation);

      // 1. Build the agent's messages
      const messages = await this.buildMessages(context, triggeringEvent);

      // 2. Publish typing indicator start
      await publisher.publishTypingIndicator("start");

      // Get tools for response processing - use agent's configured tools
      const toolNames = context.agent.tools || [];
      const tools = toolNames.map((name) => getTool(name)).filter(Boolean) as Tool[];

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
      const continueMetadata = streamResult.continueMetadata;
      const completeMetadata = streamResult.completeMetadata;

      // Build metadata with final response from ReasonActLoop
      const llmMetadata = await buildLLMMetadata(finalResponse, messages);

      // 6. Process routing decisions
      let phaseTransition: string | undefined;

      if (continueMetadata) {
        phaseTransition = continueMetadata.routingDecision.phase;

        // Handle phase transition in conversation manager with enhanced handoff
        if (this.conversationManager && phaseTransition) {
          await this.conversationManager.updatePhase(
            context.conversation.id,
            phaseTransition as Phase,
            continueMetadata.routingDecision.message,
            context.agent.pubkey,
            context.agent.name,
            continueMetadata.routingDecision.reason,
            // Enhanced handoff fields - the agent should have provided these
            continueMetadata.routingDecision.summary
          );
        }
      }

      // Handle yield_back/end_conversation tool metadata as a same-phase handoff
      if (completeMetadata && this.conversationManager && !context.agent.isOrchestrator) {
        // When a non-orchestrator agent completes, create a handoff record for the orchestrator
        const { response, summary } = completeMetadata.completion;
        
        logger.info(`[AGENT_EXECUTOR] Creating handoff from completion tool`, {
          fromAgent: context.agent.name,
          toOrchestrator: true,
          summary: summary.substring(0, 100) + "..."
        });
        
        // Use updatePhase to create a handoff record without changing phase
        await this.conversationManager.updatePhase(
          context.conversation.id,
          context.phase, // Keep the same phase
          response, // The response becomes the handoff message
          context.agent.pubkey,
          context.agent.name,
          `Task completed by ${context.agent.name}`,
          summary // Pass the detailed summary to the orchestrator
        );
      }

      // Add the agent's response to their context
      if (this.conversationManager && finalContent) {
        await this.conversationManager.addMessageToContext(
          context.conversation.id,
          context.agent.slug,
          new Message("assistant", finalContent)
        );
      }

      // 8. Check if response was already published during streaming
      let publishedEvent: NDKEvent | undefined;
      if (streamResult.wasPublished) {
        tracingLogger.debug("Response already published during streaming", {
          agentName: context.agent.name,
        });
        // We don't have the actual event ID from streaming, but we know it was published
        publishedEvent = undefined;
      } else {
        // This should not happen with the new architecture, but keep as safety fallback
        tracingLogger.error("Response was not published during streaming - publishing now", {
          agentName: context.agent.name,
        });
        publishedEvent = await this.publishResponse(
          context,
          triggeringEvent,
          finalContent,
          continueMetadata,
          completeMetadata,
          llmMetadata,
          tracingContext,
          phaseTransition
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
        const handoff = (context as AgentExecutionContext & { handoff?: PhaseTransition }).handoff;

        if (handoff) {
          logger.info(`[AGENT_EXECUTOR] Creating context from handoff`, {
            fromAgent: handoff.agentName,
            toAgent: context.agent.slug,
            handoffMessage: handoff.message.substring(0, 100) + "..."
          });
          
          // Create context with handoff information
          agentContext = this.conversationManager.createAgentContext(
            context.conversation.id,
            context.agent.slug,
            handoff
          );
        } else {
          logger.info(`[AGENT_EXECUTOR] Bootstrapping context for direct invocation`, {
            agentSlug: context.agent.slug
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
        logger.info(`[AGENT_EXECUTOR] Synchronizing existing context`, {
          agentSlug: context.agent.slug,
          currentMessages: agentContext.messages.length
        });
        
        await this.conversationManager.synchronizeAgentContext(
          context.conversation.id,
          context.agent.slug,
          triggeringEvent
        );
      }

      // Add the agent's isolated messages
      messages.push(...agentContext.messages);
      
      logger.info(`[AGENT_EXECUTOR] Final message state for agent`, {
        agentSlug: context.agent.slug,
        totalMessages: messages.length,
        messages: messages.map(m => ({
          role: m.role,
          contentPreview: m.content.substring(0, 100) + "..."
        }))
      });
    } else {
      // Fallback to old behavior if no ConversationManager
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
    continueMetadata?: ContinueMetadata,
    completeMetadata?: YieldBackMetadata | EndConversationMetadata,
    llmMetadata?: LLMMetadata,
    tracingContext?: TracingContext,
    phaseTransition?: string
  ): Promise<NDKEvent> {
    // Check if this is a phase transition request
    const additionalTags: NDKTag[] = [];
    if (phaseTransition) {
      additionalTags.push(["phase", phaseTransition]);
    }

    // This method is now only used as a fallback - should not normally be called
    const publisher = new NostrPublisher({
      conversation: context.conversation,
      agent: context.agent,
      triggeringEvent: triggeringEvent,
    });

    const event = await publisher.publishResponse({
      content,
      continueMetadata,
      completeMetadata,
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
    let finalResponse: CompletionResponse | undefined;
    let finalContent = "";
    const allToolResults: ToolExecutionResult[] = [];
    let continueMetadata: ContinueMetadata | undefined;
    let completeMetadata: YieldBackMetadata | EndConversationMetadata | undefined;
    let wasPublished = false;

    const lastMessage = messages[messages.length - 1];

    // Process the stream - ReasonActLoop handles all publishing
    const stream = this.reasonActLoop.executeStreaming(
      context,
      messages,
      tracingContext,
      publisher,
      tools
    );

    for await (const event of stream) {
      // console.log("stream", {
      //   agent: context.agent.name,
      //   messageContent: lastMessage?.content?.substring(0, 40),
      //   ...event,
      // });
      switch (event.type) {
        case "content":
          finalContent += event.content;
          break;

        case "tool_complete": {
          // Extract tool result and metadata
          const resultWithMetadata = event.result as
            | {
                metadata?: unknown;
                success?: boolean;
                error?: string;
              }
            | null
            | undefined;

          // Check if tool execution failed and publish error
          if (resultWithMetadata?.success === false && resultWithMetadata?.error && publisher) {
            try {
              await publisher.publishError(
                `Tool "${event.tool}" failed: ${resultWithMetadata.error}`
              );
              tracingLogger.info("Published tool error to conversation", {
                tool: event.tool,
                error: resultWithMetadata.error,
              });
            } catch (error) {
              tracingLogger.error("Failed to publish tool error", {
                tool: event.tool,
                originalError: resultWithMetadata.error,
                publishError: error instanceof Error ? error.message : String(error),
              });
            }
          }

          const toolResult: ToolExecutionResult = {
            success: resultWithMetadata?.success ?? true,
            output: event.result as ToolOutput,
            duration: 0,
            toolName: event.tool,
            metadata: resultWithMetadata?.metadata as
              | ToolExecutionMetadata
              | ContinueMetadata
              | YieldBackMetadata
              | EndConversationMetadata
              | undefined,
          };

          allToolResults.push(toolResult);

          // Check for special metadata
          if (resultWithMetadata?.metadata) {
            const metadata = resultWithMetadata.metadata;
            if (isContinueMetadata(metadata)) {
              continueMetadata = metadata;
            } else if (isYieldBackMetadata(metadata) || isEndConversationMetadata(metadata)) {
              completeMetadata = metadata;
            }
          }
          break;
        }

        case "done":
          finalResponse = event.response;
          // The ReasonActLoop always publishes responses when it completes
          wasPublished = true;
          break;

        case "error":
          // Handle streaming error explicitly
          tracingLogger.error("Stream reported error", {
            agentName: context.agent.name,
            error: event.error,
          });
          // Set error content and throw to be caught by outer try/catch
          finalContent = event.error || "An error occurred during processing";
          throw new Error(`Streaming failed: ${event.error}`);
      }
    }

    return {
      finalResponse:
        finalResponse ||
        ({ type: "text", content: finalContent, toolCalls: [] } as CompletionResponse),
      finalContent,
      toolExecutions: allToolResults.length,
      allToolResults,
      continueMetadata,
      completeMetadata,
      wasPublished,
    };
  }
}
