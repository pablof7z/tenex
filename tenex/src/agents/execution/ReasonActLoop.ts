import type { CompletionResponse, LLMService, Tool } from "@/llm/types";
import type { StreamEvent } from "@/llm/types";
import type { NostrPublisher } from "@/nostr/NostrPublisher";
import { StreamPublisher } from "@/nostr/NostrPublisher";
import { buildLLMMetadata } from "@/prompts/utils/llmMetadata";
import type { ToolExecutionResult, ContinueFlow, Complete, EndConversation } from "@/tools/types";
import type { RoutingDecision, CompletionSummary, ConversationResult } from "@/tools/core";
import type { TracingContext, TracingLogger } from "@/tracing";
import { createTracingLogger, createTracingContext } from "@/tracing";
import { Message } from "multi-llm-ts";
import { deserializeToolResult, isSerializedToolResult } from "@/llm/ToolResult";
import { getProjectContext } from "@/services/ProjectContext";
import type { ExecutionBackend } from "./ExecutionBackend";
import type { AgentExecutionContext } from "./types";

interface StreamingState {
  allToolResults: ToolExecutionResult[];
  continueFlow: ContinueFlow | undefined;
  termination: Complete | EndConversation | undefined;
  finalResponse: CompletionResponse | undefined;
  fullContent: string;
  streamPublisher: StreamPublisher | undefined;
}


// Type guards for tool outputs
function isContinueFlow(output: unknown): output is ContinueFlow {
  return (
    typeof output === "object" &&
    output !== null &&
    "type" in output &&
    output.type === "continue" &&
    "routing" in output &&
    isRoutingDecision(output.routing)
  );
}

function isRoutingDecision(routing: unknown): routing is RoutingDecision {
  return (
    typeof routing === "object" &&
    routing !== null &&
    "agents" in routing &&
    Array.isArray(routing.agents) &&
    routing.agents.length > 0 &&
    "reason" in routing &&
    typeof routing.reason === "string" &&
    "message" in routing &&
    typeof routing.message === "string"
  );
}

function isComplete(output: unknown): output is Complete {
  return (
    typeof output === "object" &&
    output !== null &&
    "type" in output &&
    output.type === "complete" &&
    "completion" in output &&
    isCompletionSummary(output.completion)
  );
}

function isCompletionSummary(completion: unknown): completion is CompletionSummary {
  return (
    typeof completion === "object" &&
    completion !== null &&
    "response" in completion &&
    typeof completion.response === "string" &&
    "summary" in completion &&
    typeof completion.summary === "string" &&
    "nextAgent" in completion &&
    typeof completion.nextAgent === "string"
  );
}

function isEndConversation(output: unknown): output is EndConversation {
  return (
    typeof output === "object" &&
    output !== null &&
    "type" in output &&
    output.type === "end_conversation" &&
    "result" in output &&
    isConversationResult(output.result)
  );
}

function isConversationResult(result: unknown): result is ConversationResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "response" in result &&
    typeof result.response === "string" &&
    "summary" in result &&
    typeof result.summary === "string" &&
    "success" in result &&
    typeof result.success === "boolean"
  );
}

export class ReasonActLoop implements ExecutionBackend {
  private static readonly MAX_TERMINATION_ATTEMPTS = 2;

  constructor(
    private llmService: LLMService,
    private conversationManager: import("@/conversations/ConversationManager").ConversationManager
  ) {}

  /**
   * ExecutionBackend interface implementation
   */
  async execute(
    messages: Array<import("multi-llm-ts").Message>,
    tools: Tool[],
    context: AgentExecutionContext,
    publisher: NostrPublisher
  ): Promise<void> {
    // Create tracing context
    const tracingContext = createTracingContext(context.conversation.id);

    // Execute the streaming loop and collect results
    const generator = this.executeStreamingInternal(
      context,
      messages,
      tracingContext,
      publisher,
      tools
    );

    // Drain the generator to make it execute
    let iterResult: IteratorResult<StreamEvent, void>;
    do {
      iterResult = await generator.next();
    } while (!iterResult.done);

    // Execution is complete - all state updates have been handled by the publisher
  }

  async *executeStreamingInternal(
    context: AgentExecutionContext,
    messages: Message[],
    tracingContext: TracingContext,
    publisher?: NostrPublisher,
    tools?: Tool[]
  ): AsyncGenerator<StreamEvent, void, unknown> {
    const tracingLogger = createTracingLogger(tracingContext, "agent");
    const state = this.initializeStreamingState();

    this.logStreamingStart(tracingLogger, context, tools);

    try {
      // Check if this agent requires termination enforcement
      const isBrainstormPhase = context.phase === "brainstorm";
      const requiresTerminationEnforcement = !isBrainstormPhase;

      tracingLogger.info("🚀 Starting executeStreaming with termination enforcement check", {
        agent: context.agent.name,
        isOrchestrator: context.agent.isOrchestrator,
        phase: context.phase,
        requiresTerminationEnforcement,
        reason: `phase is ${context.phase}`
      });

      let currentMessages = messages;
      let attempt = 0;

      // Allow up to MAX_TERMINATION_ATTEMPTS attempts for proper termination
      while (attempt < ReasonActLoop.MAX_TERMINATION_ATTEMPTS) {
        attempt++;
        
        tracingLogger.info(`🔄 Termination attempt ${attempt}/${ReasonActLoop.MAX_TERMINATION_ATTEMPTS}`, {
          agent: context.agent.name,
          phase: context.phase,
          isOrchestrator: context.agent.isOrchestrator,
          requiresTerminationEnforcement,
          messageCount: currentMessages.length
        });
        
        // Create stream for this attempt
        const stream = this.createLLMStream(context, currentMessages, tools, publisher);
        const streamPublisher = attempt === 1 
          ? this.setupStreamPublisher(publisher, tracingLogger, context)
          : state.streamPublisher; // Reuse existing stream publisher for reminder

        // Reset state for new attempt (but keep streamPublisher)
        if (attempt > 1) {
          tracingLogger.info("🔄 Resetting state for reminder attempt", {
            previousContent: state.fullContent.substring(0, 100) + "...",
            hadTermination: !!state.termination,
            hadContinueFlow: !!state.continueFlow
          });
          state.fullContent = "";
          state.finalResponse = undefined;
          state.termination = undefined;
          state.continueFlow = undefined;
          state.allToolResults = [];
        }

        // Process the stream
        yield* this.processStreamEvents(
          stream,
          state,
          streamPublisher,
          publisher,
          tracingLogger,
          context
        );

        // Finalize the stream
        await this.finalizeStream(streamPublisher, state, context, currentMessages, tracingLogger);

        // Check if termination is correct
        const hasTerminated = state.termination || state.continueFlow;
        
        tracingLogger.info("📊 Termination check after attempt", {
          attempt,
          hasTerminated,
          hasTermination: !!state.termination,
          hasContinueFlow: !!state.continueFlow,
          terminationType: state.termination?.type,
          continueAgents: state.continueFlow?.routing?.agents,
          requiresTerminationEnforcement,
          contentLength: state.fullContent.length,
          toolCallCount: state.allToolResults.length
        });
        
        // If terminated properly, we're done
        if (hasTerminated || !requiresTerminationEnforcement) {
          tracingLogger.info("✅ Termination successful or not required", {
            hasTerminated,
            requiresTerminationEnforcement,
            reason: hasTerminated ? "Agent called terminal tool" : "Termination not enforced for this context"
          });
          break;
        }

        // If this is the last attempt, auto-complete
        if (attempt === ReasonActLoop.MAX_TERMINATION_ATTEMPTS) {
          tracingLogger.info("⚠️ Max attempts reached, auto-completing", {
            agent: context.agent.name,
            phase: context.phase
          });
          this.autoCompleteTermination(state, context, tracingLogger);
          
          // Publish the auto-generated termination event
          if (publisher && state.termination) {
            tracingLogger.info("Publishing auto-generated termination event", {
              terminationType: state.termination.type,
              agent: context.agent.name
            });
            
            if (state.termination.type === 'complete') {
              await publisher.publishResponse({
                content: state.termination.completion.response,
                destinationPubkeys: [state.termination.completion.nextAgent],
                completeMetadata: state.termination
              });
            } else if (state.termination.type === 'end_conversation') {
              await publisher.publishResponse({
                content: state.termination.result.response,
                completeMetadata: state.termination
              });
            }
          }
          
          break;
        }

        // Otherwise, prepare reminder for next attempt
        tracingLogger.info(`📢 ${context.agent.isOrchestrator ? "Orchestrator" : "Non-orchestrator"} agent did not call terminal tool, preparing reminder`, {
          agent: context.agent.name,
          phase: context.phase,
          attempt,
          currentContentPreview: state.fullContent.substring(0, 100) + "..."
        });

        const reminderMessage = this.getReminderMessage(context);
        tracingLogger.info("📝 Reminder message prepared", {
          messagePreview: reminderMessage.substring(0, 100) + "...",
          previousMessageCount: currentMessages.length
        });
        
        currentMessages = [
          ...currentMessages,
          new Message("assistant", state.fullContent),
          new Message("user", reminderMessage)
        ];
      }
      
      tracingLogger.info("🏁 Creating final event", {
        hasTermination: !!state.termination,
        hasContinueFlow: !!state.continueFlow,
        terminationType: state.termination?.type,
        continueAgents: state.continueFlow?.routing?.agents,
        contentLength: state.fullContent.length,
        agent: context.agent.name,
        phase: context.phase
      });
      
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

    // Execution is complete - all state updates have been handled by the publisher
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
    context: AgentExecutionContext,
    tools?: Tool[]
  ): void {
    tracingLogger.info("🔄 Starting ReasonActLoop", {
      agent: context.agent.name,
      phase: context.phase,
      tools: tools?.map((t) => t.name).join(", "),
    });
  }

  private createLLMStream(
    context: AgentExecutionContext,
    messages: Message[],
    tools?: Tool[],
    publisher?: NostrPublisher
  ): ReturnType<LLMService["stream"]> {
    return this.llmService.stream({
      messages,
      options: {
        configName: context.agent.llmConfig,
        agentName: context.agent.name,
      },
      tools,
      toolContext: {
        projectPath: context.projectPath,
        conversationId: context.conversation.id,
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
    context: AgentExecutionContext
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
    context: AgentExecutionContext
  ): AsyncGenerator<StreamEvent> {
    state.streamPublisher = streamPublisher;

    for await (const event of stream) {
      yield event;

      switch (event.type) {
        case "content":
          this.handleContentEvent(event, state, streamPublisher);
          break;

        case "tool_start":
          await this.handleToolStartEvent(streamPublisher, publisher, event.tool, event.args, tracingLogger);
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
    toolArgs: Record<string, unknown>,
    tracingLogger: TracingLogger
  ): Promise<void> {
    await streamPublisher?.flush();
    
    // Publish typing indicator with tool information
    if (publisher) {
      // Format the tool usage message
      let message = `@${publisher.context.agent.name} is using ${toolName}`;
      
      // Add key parameters to the message
      if (toolArgs && Object.keys(toolArgs).length > 0) {
        const keyParams: string[] = [];
        
        // Handle common file/path parameters
        if (toolArgs.file_path || toolArgs.path) {
          keyParams.push(`${toolArgs.file_path || toolArgs.path}`);
        } else if (toolArgs.filename) {
          keyParams.push(`${toolArgs.filename}`);
        }
        
        // Handle other notable parameters
        if (toolArgs.url && typeof toolArgs.url === 'string') {
          keyParams.push(`${toolArgs.url}`);
        }
        
        if (toolArgs.query && typeof toolArgs.query === 'string') {
          keyParams.push(`"${toolArgs.query}"`);
        }
        
        if (toolArgs.pattern && typeof toolArgs.pattern === 'string') {
          keyParams.push(`pattern: "${toolArgs.pattern}"`);
        }
        
        if (keyParams.length > 0) {
          message += ` with ${keyParams.join(', ')}`;
        }
      }
      
      tracingLogger.debug("Publishing typing indicator with tool info", {
        tool: toolName,
        hasArgs: Object.keys(toolArgs).length > 0,
        message
      });
      
      await publisher.publishTypingIndicator("start", message);
    }
  }

  private async handleToolCompleteEvent(
    event: { tool: string; result: unknown },
    state: StreamingState,
    streamPublisher: StreamPublisher | undefined,
    publisher: NostrPublisher | undefined,
    tracingLogger: TracingLogger,
    context: AgentExecutionContext
  ): Promise<boolean> {
    tracingLogger.info("🛠️ Tool complete event received", {
      tool: event.tool,
      agent: context.agent.name,
      isOrchestrator: context.agent.isOrchestrator,
      phase: context.phase
    });

    const toolResult = this.parseToolResult(event);
    state.allToolResults.push(toolResult);

    // Check if tool execution failed and publish error
    if (!toolResult.success && toolResult.error && publisher) {
      try {
        // Format error message based on error type
        let errorMessage: string;
        if (typeof toolResult.error === 'string') {
          errorMessage = toolResult.error;
        } else if (toolResult.error && typeof toolResult.error === 'object' && 'message' in toolResult.error) {
          errorMessage = (toolResult.error as {message: string}).message;
        } else {
          errorMessage = JSON.stringify(toolResult.error);
        }
        
        await publisher.publishError(
          `Tool "${event.tool}" failed: ${errorMessage}`
        );
        tracingLogger.info("Published tool error to conversation", {
          tool: event.tool,
          error: errorMessage,
        });
      } catch (error) {
        tracingLogger.error("Failed to publish tool error", {
          tool: event.tool,
          originalError: toolResult.error,
          publishError: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.processToolResult(toolResult, state, tracingLogger, context);

    await streamPublisher?.flush();
    publisher?.publishTypingIndicator("stop");

    // Check if this is a terminal tool
    const isTerminal = this.isTerminalResult(toolResult);
    
    tracingLogger.info("🔍 Terminal tool check", {
      tool: event.tool,
      isTerminal,
      hasTermination: !!state.termination,
      hasContinueFlow: !!state.continueFlow,
      terminationType: state.termination?.type,
      agent: context.agent.name
    });

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
    context: AgentExecutionContext
  ): void {
    tracingLogger.info("🔧 Processing tool result", {
      success: toolResult.success,
      hasOutput: !!toolResult.output,
      outputType: toolResult.output && typeof toolResult.output === "object" && toolResult.output !== null && "type" in toolResult.output ? String(toolResult.output.type) : "none",
      agent: context.agent.name,
      isOrchestrator: context.agent.isOrchestrator
    });

    if (!toolResult.success || !toolResult.output) {
      tracingLogger.info("⚠️ Tool result unsuccessful or missing output", {
        success: toolResult.success,
        hasOutput: !!toolResult.output
      });
      return;
    }

    const output = toolResult.output;

    // Check if it's a continue flow
    if (isContinueFlow(output)) {
      // Only process the first continue
      if (state.continueFlow) {
        tracingLogger.info("⚠️ Multiple continue calls detected - ignoring additional calls", {
          existingAgents: state.continueFlow.routing.agents,
          newAgents: output.routing.agents,
        });
        return;
      }

      state.continueFlow = output;
      tracingLogger.info("🔄 Continue routing detected in streaming", {
        agents: output.routing.agents,
        phase: output.routing.phase,
        agent: context.agent.name,
        isOrchestrator: context.agent.isOrchestrator
      });

      // Increment continue call count
      if (this.conversationManager && context.conversation.id && context.phase) {
        this.conversationManager
          .incrementContinueCallCount(context.conversation.id, context.phase)
          .catch((error) => {
            tracingLogger.error("Failed to increment continue call count", {
              error: error instanceof Error ? error.message : String(error),
              conversationId: context.conversation.id,
              phase: context.phase,
            });
          });
      }
    }

    // Check if it's a termination (complete or end_conversation)
    if (isComplete(output)) {
      state.termination = output;
      tracingLogger.info("✅ Complete termination detected in streaming", {
        type: output.type,
        hasResponse: !!output.completion.response,
        summaryPreview: (output.completion.summary || "").substring(0, 50) + "...",
        agent: context.agent.name,
        isOrchestrator: context.agent.isOrchestrator
      });
    } else if (isEndConversation(output)) {
      state.termination = output;
      tracingLogger.info("✅ End conversation termination detected in streaming", {
        type: output.type,
        hasResponse: !!output.result.response,
        summaryPreview: (output.result.summary || "").substring(0, 50) + "...",
        agent: context.agent.name,
        isOrchestrator: context.agent.isOrchestrator
      });
    } else {
      tracingLogger.info("ℹ️ Tool result not a terminal tool", {
        outputType: typeof output === "object" && output !== null && "type" in output ? String(output.type) : "unknown",
        agent: context.agent.name
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
    context: AgentExecutionContext,
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
      metadata.continueMetadata = state.continueFlow;
    } else if (state.termination) {
      if (state.termination.type === "complete") {
        metadata.completeMetadata = state.termination;
      } else if (state.termination.type === "end_conversation") {
        metadata.completeMetadata = state.termination;
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

  private getReminderMessage(context: AgentExecutionContext): string {
    if (context.agent.isOrchestrator) {
      return `I see you've finished responding, but you haven't used the 'continue' or 'end_conversation' tool yet. As the orchestrator in the ${context.phase} phase, you MUST either:
- Use the 'continue' tool to route to appropriate agents for the next task
- Use the 'end_conversation' tool if all work is complete and you're ready to end the conversation
Please use one of these tools now.`;
    } else {
      return "I see you've finished responding, but you haven't used the 'complete' tool yet. As a non-orchestrator agent, you MUST use the 'complete' tool to signal that your work is done and report back to the orchestrator. Please use the 'complete' tool now with a summary of what you accomplished.";
    }
  }

  private autoCompleteTermination(
    state: StreamingState,
    context: AgentExecutionContext,
    tracingLogger: TracingLogger
  ): void {
    tracingLogger.error(`${context.agent.isOrchestrator ? "Orchestrator" : "Agent"} failed to call terminal tool even after reminder - auto-completing`, {
      agent: context.agent.name,
      phase: context.phase,
      conversationId: context.conversation.id,
      isOrchestrator: context.agent.isOrchestrator
    });
    
    const autoCompleteContent = state.fullContent || "Task completed";
    
    if (context.agent.isOrchestrator) {
      // For orchestrator, we'll auto-end the conversation
      state.termination = {
        type: "end_conversation",
        result: {
          response: autoCompleteContent,
          summary: `Orchestrator in ${context.phase} phase completed its turn but failed to call continue or end_conversation after a reminder. [Auto-ended by system]`,
          success: true
        }
      };
    } else {
      // For non-orchestrator, complete back to orchestrator
      const projectContext = getProjectContext();
      const orchestratorAgent = projectContext.getProjectAgent();
      
      state.termination = {
        type: "complete",
        completion: {
          response: autoCompleteContent,
          summary: "Agent completed its turn but failed to call the complete tool after a reminder. [Auto-completed by system]",
          nextAgent: orchestratorAgent.pubkey
        }
      };
    }
    
    // Update the final response to include the auto-completion
    state.fullContent = autoCompleteContent;
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
    context: AgentExecutionContext
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

    publisher?.publishTypingIndicator("stop");

    yield {
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }

}
