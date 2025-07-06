import type { Phase } from "@/conversations/phases";
import type { CompletionResponse, LLMService, StreamEvent, Tool } from "@/llm/types";
import type { NostrPublisher } from "@/nostr/NostrPublisher";
import { StreamPublisher } from "@/nostr/NostrPublisher";
import { buildLLMMetadata } from "@/prompts/utils/llmMetadata";
import type { ToolExecutionResult, ContinueFlow, YieldBack, EndConversation } from "@/tools/types";
import type { TracingContext, TracingLogger } from "@/tracing";
import { createTracingLogger } from "@/tracing";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { Message } from "multi-llm-ts";
import { deserializeToolResult, isSerializedToolResult } from "@/llm/ToolResult";

import type { Agent } from "@/agents/types";
import type { Conversation } from "@/conversations/types";

interface StreamingState {
  allToolResults: ToolExecutionResult[];
  continueFlow: ContinueFlow | undefined;
  termination: YieldBack | EndConversation | undefined;
  finalResponse: CompletionResponse | undefined;
  fullContent: string;
  streamPublisher: StreamPublisher | undefined;
}

export interface ReasonActContext {
  projectPath: string;
  conversationId: string;
  phase: Phase;
  llmConfig: string;
  agent: Agent;
  conversation: Conversation;
  eventToReply?: NDKEvent;
}

export interface ReasonActResult {
  finalResponse: CompletionResponse;
  finalContent: string;
  toolExecutions: number;
  allToolResults?: ToolExecutionResult[];
  continueFlow?: ContinueFlow;
  termination?: YieldBack | EndConversation;
  wasPublished?: boolean;
}

export class ReasonActLoop {
  private static readonly MAX_ITERATIONS = 3;
  private static readonly COMPLETE_REMINDER_KEY = "_complete_reminder_sent";

  constructor(
    private llmService: LLMService,
    private conversationManager?: import("@/conversations/ConversationManager").ConversationManager
  ) {}

  async *executeStreaming(
    context: ReasonActContext,
    messages: Message[],
    tracingContext: TracingContext,
    publisher?: NostrPublisher,
    tools?: Tool[]
  ): AsyncGenerator<StreamEvent, ReasonActResult, unknown> {
    const tracingLogger = createTracingLogger(tracingContext, "agent");
    const state = this.initializeStreamingState();

    this.logStreamingStart(tracingLogger, context, tools);

    try {
      const stream = this.createLLMStream(context, messages, tools, publisher);
      const streamPublisher = this.setupStreamPublisher(publisher, tracingLogger, context);

      yield* this.processStreamEvents(
        stream,
        state,
        streamPublisher,
        publisher,
        tracingLogger,
        context
      );

      await this.finalizeStream(streamPublisher, state, context, messages, tracingLogger);
      
      // Multi-layered guardrail for non-orchestrator agents
      if (!context.agent.isOrchestrator && !state.termination && !state.continueFlow) {
        // Check if this is already a reminder attempt
        const lastMessage = messages[messages.length - 1];
        const reminderAlreadySent = lastMessage?.content?.includes("you haven't used the 'complete' tool yet");
        
        if (!reminderAlreadySent) {
          // Layer 1: Send reminder
          tracingLogger.info("Non-orchestrator agent did not call complete(), sending reminder");
          
          // Add a system message reminding the agent to complete
          const reminderMessages = [
            ...messages, 
            new Message("assistant", state.fullContent),
            new Message("user", "I see you've finished responding, but you haven't used the 'complete' tool yet. As a non-orchestrator agent, you MUST use the 'complete' tool to signal that your work is done and report back to the orchestrator. Please use the 'complete' tool now with a summary of what you accomplished.")
          ];
          
          // Make another LLM call with the reminder
          const reminderStream = this.createLLMStream(context, reminderMessages, tools, publisher);
          
          // Store the original content before resetting
          const originalContent = state.fullContent;
          
          // Reset state for the reminder attempt
          state.fullContent = "";
          state.finalResponse = undefined;
          state.termination = undefined;
          state.continueFlow = undefined;
          
          // Process the reminder stream
          yield* this.processStreamEvents(
            reminderStream,
            state,
            streamPublisher,
            publisher,
            tracingLogger,
            context
          );
          
          // Finalize again with the new state
          await this.finalizeStream(streamPublisher, state, context, reminderMessages, tracingLogger);
          
          // Layer 2: Auto-complete if agent still didn't comply
          if (!state.termination && !state.continueFlow) {
            tracingLogger.error("Agent failed to call complete() even after reminder - auto-completing", {
              agent: context.agent.name,
              phase: context.phase,
              conversationId: context.conversationId
            });
            
            // Create auto-completion
            const autoCompleteContent = state.fullContent || originalContent || "Task completed";
            state.termination = {
              type: "complete",
              completion: {
                response: autoCompleteContent,
                summary: "Agent completed its turn but failed to call the complete tool after a reminder. [Auto-completed by system]",
                nextAgent: context.conversation.history[0]?.pubkey || "" // Orchestrator pubkey
              }
            };
            
            // Update the final response to include the auto-completion
            state.fullContent = autoCompleteContent;
          }
        } else {
          // This was already a reminder attempt that failed - should not happen with Layer 2
          tracingLogger.error("Critical: Agent in reminder loop - this should not happen with auto-completion", undefined, {
            agent: context.agent.name
          });
        }
      }
      
      yield this.createFinalEvent(state);
    } catch (error) {
      yield* this.handleStreamingError(
        error,
        publisher,
        state.streamPublisher,
        tracingLogger,
        context
      );
      throw error;
    }

    // Return the final result
    return {
      finalResponse:
        state.finalResponse ||
        ({
          content: state.fullContent,
          toolCalls: [],
          type: "text",
        } as CompletionResponse),
      finalContent: state.fullContent,
      toolExecutions: state.allToolResults.length,
      allToolResults: state.allToolResults,
      continueFlow: state.continueFlow,
      termination: state.termination,
      wasPublished: !!state.streamPublisher,
    };
  }

  private initializeStreamingState(): StreamingState {
    return {
      allToolResults: [],
      continueFlow: undefined,
      termination: undefined,
      finalResponse: undefined,
      fullContent: "",
      streamPublisher: undefined,
    };
  }

  private logStreamingStart(
    tracingLogger: TracingLogger,
    context: ReasonActContext,
    tools?: Tool[]
  ): void {
    tracingLogger.info("🔄 Starting ReasonActLoop", {
      agent: context.agent.name,
      phase: context.phase,
      tools: tools?.map((t) => t.name).join(", "),
    });
  }

  private createLLMStream(
    context: ReasonActContext,
    messages: Message[],
    tools?: Tool[],
    publisher?: NostrPublisher
  ): ReturnType<LLMService["stream"]> {
    return this.llmService.stream({
      messages,
      options: {
        configName: context.llmConfig,
        agentName: context.agent.name,
      },
      tools,
      toolContext: {
        projectPath: context.projectPath,
        conversationId: context.conversationId,
        phase: context.phase,
        agent: context.agent,
        conversation: context.conversation,
        publisher: publisher as NostrPublisher,
        triggeringEvent: context.eventToReply,
        conversationManager: this.conversationManager,
      },
    });
  }

  private setupStreamPublisher(
    publisher: NostrPublisher | undefined,
    tracingLogger: TracingLogger,
    context: ReasonActContext
  ): StreamPublisher | undefined {
    if (!publisher) return undefined;

    const streamPublisher = new StreamPublisher(publisher);
    tracingLogger.info("Stream publisher initialized", {
      agent: context.agent.name,
    });
    return streamPublisher;
  }

  private async *processStreamEvents(
    stream: AsyncIterable<StreamEvent>,
    state: StreamingState,
    streamPublisher: StreamPublisher | undefined,
    publisher: NostrPublisher | undefined,
    tracingLogger: TracingLogger,
    context: ReasonActContext
  ): AsyncGenerator<StreamEvent> {
    state.streamPublisher = streamPublisher;

    for await (const event of stream) {
      yield event;

      switch (event.type) {
        case "content":
          this.handleContentEvent(event, state, streamPublisher);
          break;

        case "tool_start":
          await this.handleToolStartEvent(streamPublisher, publisher, event.tool, tracingLogger);
          break;

        case "tool_complete": {
          const isTerminal = await this.handleToolCompleteEvent(
            event,
            state,
            streamPublisher,
            publisher,
            tracingLogger,
            context
          );

          // If this was a terminal tool, the tool has already published - just return
          if (isTerminal) {
            tracingLogger.info("Terminal tool detected - event already published by tool", {
              tool: event.tool,
              type: state.continueFlow ? "routing" : "completion",
            });
            
            // Don't finalize - routing tools publish directly
            yield this.createFinalEvent(state);
            return;
          }
          break;
        }

        case "done":
          this.handleDoneEvent(event, state, tracingLogger);
          break;

        case "error":
          this.handleErrorEvent(event, state, streamPublisher, tracingLogger);
          break;
      }
    }
  }

  private handleContentEvent(
    event: { content: string },
    state: StreamingState,
    streamPublisher?: StreamPublisher
  ): void {
    state.fullContent += event.content;
    streamPublisher?.addContent(event.content);
  }

  private async handleToolStartEvent(
    streamPublisher: StreamPublisher | undefined,
    publisher: NostrPublisher | undefined,
    toolName: string,
    tracingLogger: TracingLogger
  ): Promise<void> {
    await streamPublisher?.flush();
    await this.publishTypingIndicator(publisher, toolName, tracingLogger);
  }

  private async handleToolCompleteEvent(
    event: { tool: string; result: unknown },
    state: StreamingState,
    streamPublisher: StreamPublisher | undefined,
    publisher: NostrPublisher | undefined,
    tracingLogger: TracingLogger,
    context: ReasonActContext
  ): Promise<boolean> {
    const toolResult = this.parseToolResult(event);
    state.allToolResults.push(toolResult);

    this.processToolResult(toolResult, state, tracingLogger, context);

    await streamPublisher?.flush();
    await this.stopTypingIndicator(publisher, event.tool, tracingLogger);

    // Check if this is a terminal tool
    const isTerminal = this.isTerminalResult(toolResult);

    return isTerminal;
  }

  private parseToolResult(event: { tool: string; result: unknown }): ToolExecutionResult {
    // Check if we have a typed result from ToolPlugin
    if (!event.result || typeof event.result !== "object") {
      throw new Error(`Tool '${event.tool}' returned invalid result format`);
    }

    const result = event.result as Record<string, unknown>;

    // Tool results must include the typed result
    if (!result.__typedResult || !isSerializedToolResult(result.__typedResult)) {
      throw new Error(
        `Tool '${event.tool}' returned invalid result format. Missing or invalid __typedResult.`
      );
    }

    return deserializeToolResult(result.__typedResult);
  }

  private processToolResult(
    toolResult: ToolExecutionResult,
    state: StreamingState,
    tracingLogger: TracingLogger,
    context: ReasonActContext
  ): void {
    if (!toolResult.success || !toolResult.output) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output = toolResult.output as any;

    // Check if it's a continue flow
    if (output.type === "continue" && output.routing) {
      // Only process the first continue
      if (state.continueFlow) {
        tracingLogger.info("⚠️ Multiple continue calls detected - ignoring additional calls", {
          existingAgents: state.continueFlow.routing.agents,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          newAgents: (output.routing as any).agents,
        });
        return;
      }

      state.continueFlow = output as ContinueFlow;
      tracingLogger.info("🔄 Continue routing detected in streaming", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        agents: (output.routing as any).agents,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        phase: (output.routing as any).phase,
      });

      // Increment continue call count
      if (this.conversationManager && context.conversationId && context.phase) {
        this.conversationManager
          .incrementContinueCallCount(context.conversationId, context.phase)
          .catch((error) => {
            tracingLogger.error("Failed to increment continue call count", {
              error: error instanceof Error ? error.message : String(error),
              conversationId: context.conversationId,
              phase: context.phase,
            });
          });
      }
    }

    // Check if it's a termination (complete or end_conversation)
    if (output.type === "complete" && output.completion) {
      state.termination = output as YieldBack;
      tracingLogger.info("✅ Termination detected in streaming", {
        type: output.type,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hasResponse: !!(output.completion as any).response,
      });
    } else if (output.type === "end_conversation" && output.result) {
      state.termination = output as EndConversation;
      tracingLogger.info("✅ Termination detected in streaming", {
        type: output.type,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hasResponse: !!(output.result as any).response,
      });
    }
  }

  private isTerminalResult(result: ToolExecutionResult): boolean {
    if (!result.success || !result.output) {
      return false;
    }

    const output = result.output as Record<string, unknown>;
    // Check if it's a control flow or termination
    return output.type === "continue" ||
           output.type === "complete" ||
           output.type === "end_conversation";
  }

  private handleDoneEvent(
    event: { response?: CompletionResponse },
    state: StreamingState,
    tracingLogger: TracingLogger
  ): void {
    state.finalResponse = event.response;
    tracingLogger.info("Stream completed", {
      contentLength: state.fullContent.length,
      hasResponse: !!event.response,
    });
  }

  private handleErrorEvent(
    event: { error: string },
    state: StreamingState,
    streamPublisher: StreamPublisher | undefined,
    tracingLogger: TracingLogger
  ): void {
    tracingLogger.error("Stream error", { error: event.error });
    state.fullContent += `\n\nError: ${event.error}`;
    streamPublisher?.addContent(`\n\nError: ${event.error}`);
  }

  private async finalizeStream(
    streamPublisher: StreamPublisher | undefined,
    state: StreamingState,
    context: ReasonActContext,
    messages: Message[],
    tracingLogger: TracingLogger
  ): Promise<void> {
    if (!streamPublisher || streamPublisher.isFinalized()) return;

    const llmMetadata = state.finalResponse
      ? await buildLLMMetadata(state.finalResponse, messages)
      : undefined;

    // Convert flow/termination to metadata for finalization
    const metadata: Record<string, unknown> = {};
    if (state.continueFlow) {
      metadata.continueMetadata = {
        routingDecision: state.continueFlow.routing,
      };
    } else if (state.termination) {
      if (state.termination.type === "complete") {
        metadata.completeMetadata = {
          completion: state.termination.completion,
        };
      } else if (state.termination.type === "end_conversation") {
        metadata.completeMetadata = {
          completion: {
            response: state.termination.result.response,
            summary: state.termination.result.summary,
            nextAgent: context.conversation.history[0]?.pubkey || "",
          },
        };
      }
    }

    await streamPublisher.finalize({
      llmMetadata,
      ...metadata,
    });

    tracingLogger.info("Stream finalized", {
      hasLLMMetadata: !!llmMetadata,
      hasContinueFlow: !!state.continueFlow,
      hasTermination: !!state.termination,
    });
  }

  private createFinalEvent(state: StreamingState): StreamEvent {
    const baseEvent: StreamEvent = {
      type: "done",
      response: state.finalResponse || {
        type: "text",
        content: state.fullContent,
        toolCalls: [],
      },
    };
    
    // Add additional properties that AgentExecutor expects
    return Object.assign(baseEvent, {
      continueFlow: state.continueFlow,
      termination: state.termination,
    }) as StreamEvent;
  }

  private async *handleStreamingError(
    error: unknown,
    publisher: NostrPublisher | undefined,
    streamPublisher: StreamPublisher | undefined,
    tracingLogger: TracingLogger,
    context: ReasonActContext
  ): AsyncGenerator<StreamEvent> {
    tracingLogger.error("Streaming error", {
      error: error instanceof Error ? error.message : String(error),
      agent: context.agent.name,
    });

    if (streamPublisher && !streamPublisher.isFinalized()) {
      try {
        await streamPublisher.finalize({});
      } catch (finalizeError) {
        tracingLogger.error("Failed to finalize stream on error", {
          error: finalizeError instanceof Error ? finalizeError.message : String(finalizeError),
        });
      }
    }

    await this.stopTypingIndicator(publisher, "error", tracingLogger);

    yield {
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  private async publishTypingIndicator(
    publisher: NostrPublisher | undefined,
    toolName: string,
    tracingLogger: TracingLogger
  ): Promise<void> {
    if (!publisher) return;

    try {
      await publisher.publishTypingIndicator("start");
      tracingLogger.debug(`Typing indicator started for tool: ${toolName}`);
    } catch (error) {
      tracingLogger.error("Failed to publish typing indicator", {
        tool: toolName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async stopTypingIndicator(
    publisher: NostrPublisher | undefined,
    toolName: string,
    tracingLogger: TracingLogger
  ): Promise<void> {
    if (!publisher) return;

    try {
      await publisher.publishTypingIndicator("stop");
      tracingLogger.debug(`Typing indicator stopped for tool: ${toolName}`);
    } catch (error) {
      tracingLogger.error("Failed to stop typing indicator", {
        tool: toolName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
