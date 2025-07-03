import type { Phase } from "@/conversations/phases";
import type { CompletionResponse, LLMService, StreamEvent, Tool } from "@/llm/types";
import type { NostrPublisher } from "@/nostr/NostrPublisher";
import type { StreamPublisher } from "@/nostr/NostrPublisher";
import type { LLMMetadata } from "@/nostr/types";
import { buildLLMMetadata } from "@/prompts/utils/llmMetadata";
import type {
    CompleteMetadata,
    ContinueMetadata,
    ToolExecutionMetadata,
    ToolExecutionResult,
    ToolOutput,
} from "@/tools/types";
import { isCompleteMetadata, isContinueMetadata } from "@/tools/types";
import type { TracingContext, TracingLogger } from "@/tracing";
import { createTracingLogger } from "@/tracing";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { Message } from "multi-llm-ts";

import type { Agent } from "@/agents/types";
import type { Conversation } from "@/conversations/types";

export interface ReasonActContext {
    projectPath: string;
    conversationId: string;
    phase: Phase;
    llmConfig: string;
    agent: Agent;
    conversation: Conversation;
    eventToReply?: NDKEvent;
    nextAgent?: string;
}

export interface ReasonActResult {
    finalResponse: CompletionResponse;
    finalContent: string;
    toolExecutions: number;
    allToolResults?: ToolExecutionResult[]; // Array of actual tool execution results
    continueMetadata?: ContinueMetadata;
    completeMetadata?: CompleteMetadata;
    wasPublished?: boolean; // Track if response was published during streaming
}

export class ReasonActLoop {
    private static readonly MAX_ITERATIONS = 3;

    constructor(private llmService: LLMService) {}

    async execute(
        initialResponse: CompletionResponse,
        context: ReasonActContext,
        _messages: Message[],
        tracingContext: TracingContext,
        initialLLMMetadata?: LLMMetadata,
        _tools?: Tool[]
    ): Promise<ReasonActResult> {
        const tracingLogger = createTracingLogger(tracingContext, "agent");
        const allToolResults: ToolExecutionResult[] = [];
        let continueMetadata: ContinueMetadata | undefined;
        let completeMetadata: CompleteMetadata | undefined;

        // Native function calls are already executed by multi-llm-ts
        if (initialResponse.toolCalls && initialResponse.toolCalls.length > 0) {
            tracingLogger.info("📊 Native tool execution results", {
                agent: context.agent.name,
                toolCount: initialResponse.toolCalls.length,
                tools: initialResponse.toolCalls.map((tc) => ({
                    name: tc.name,
                    hasResult: !!tc.result,
                })),
            });

            // Convert native tool calls to ToolExecutionResult format
            for (const toolCall of initialResponse.toolCalls) {
                const toolResult: ToolExecutionResult = {
                    success: true,
                    output: toolCall.result,
                    duration: 0, // Native calls don't provide duration
                    toolName: toolCall.name,
                    metadata: toolCall.result?.metadata,
                };

                allToolResults.push(toolResult);

                // Check for special metadata
                if (toolCall.result?.metadata) {
                    if (isContinueMetadata(toolCall.result.metadata)) {
                        continueMetadata = toolCall.result.metadata;
                    } else if (isCompleteMetadata(toolCall.result.metadata)) {
                        completeMetadata = toolCall.result.metadata;
                    }
                }
            }

            // Publish the response with tool results
            if (context.eventToReply && context.agent.signer && initialLLMMetadata) {
                try {
                    // TODO: Publishing should be handled by the caller with NostrPublisher
                    // For now, non-streaming path doesn't publish
                    tracingLogger.info(
                        "Non-streaming path - publishing should be handled by caller",
                        {
                            agent: context.agent.name,
                        }
                    );

                    tracingLogger.debug("Published response with native tool calls", {
                        agent: context.agent.name,
                        toolCount: initialResponse.toolCalls.length,
                    });
                } catch (error) {
                    tracingLogger.error("Failed to publish response", {
                        agent: context.agent.name,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        }

        return {
            finalResponse: initialResponse,
            finalContent: initialResponse.content || "",
            toolExecutions: initialResponse.toolCalls?.length || 0,
            allToolResults,
            continueMetadata,
            completeMetadata,
            wasPublished: !!(
                context.eventToReply &&
                context.agent.signer &&
                initialLLMMetadata &&
                initialResponse.toolCalls?.length
            ),
        };
    }

    async *executeStreaming(
        context: ReasonActContext,
        messages: Message[],
        tracingContext: TracingContext,
        publisher?: NostrPublisher,
        tools?: Tool[]
    ): AsyncIterable<StreamEvent> {
        const tracingLogger = createTracingLogger(tracingContext, "agent");
        const state = this.initializeStreamingState();
        
        this.logStreamingStart(tracingLogger, context, tools);

        try {
            const stream = this.createLLMStream(context, messages, tools);
            const streamPublisher = this.setupStreamPublisher(publisher, tracingLogger, context);

            yield* this.processStreamEvents(stream, state, streamPublisher, publisher, tracingLogger);
            
            await this.finalizeStream(streamPublisher, state, context, messages, tracingLogger);
            yield this.createFinalEvent(state);
        } catch (error) {
            yield* this.handleStreamingError(error, publisher, state.streamPublisher, tracingLogger, context);
            throw error;
        }
    }

    private initializeStreamingState() {
        return {
            allToolResults: [] as ToolExecutionResult[],
            continueMetadata: undefined as ContinueMetadata | undefined,
            completeMetadata: undefined as CompleteMetadata | undefined,
            finalResponse: undefined as CompletionResponse | undefined,
            fullContent: "",
            streamPublisher: undefined as StreamPublisher | undefined,
        };
    }

    private logStreamingStart(tracingLogger: TracingLogger, context: ReasonActContext, tools?: Tool[]) {
        tracingLogger.info("🔄 Starting streaming execution", {
            agent: context.agent.name,
            phase: context.phase,
            hasTools: !!(tools && tools.length > 0),
            tools: JSON.stringify(tools, null, 4),
        });
    }

    private createLLMStream(context: ReasonActContext, messages: Message[], tools?: Tool[]) {
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
                agentSigner: context.agent.signer,
                conversationRootEventId: context.conversation.history[0]?.id,
            },
        });
    }

    private setupStreamPublisher(publisher: NostrPublisher | undefined, tracingLogger: TracingLogger, context: ReasonActContext) {
        const streamPublisher = publisher?.createStreamPublisher();
        if (!streamPublisher) {
            tracingLogger.info("No publisher provided - streaming without publishing", {
                agent: context.agent.name,
            });
        }
        return streamPublisher;
    }

    private async *processStreamEvents(
        stream: AsyncIterable<StreamEvent>,
        state: ReturnType<typeof this.initializeStreamingState>,
        streamPublisher: StreamPublisher | undefined,
        publisher: NostrPublisher | undefined,
        tracingLogger: TracingLogger
    ): AsyncIterable<StreamEvent> {
        state.streamPublisher = streamPublisher;
        
        for await (const event of stream) {
            yield event;

            switch (event.type) {
                case "content":
                    this.handleContentEvent(event, state, streamPublisher);
                    break;

                case "tool_start":
                    await this.handleToolStartEvent(event, streamPublisher, publisher, tracingLogger);
                    break;

                case "tool_complete":
                    await this.handleToolCompleteEvent(event, state, streamPublisher, publisher, tracingLogger);
                    break;

                case "done":
                    this.handleDoneEvent(event, state, tracingLogger);
                    break;

                case "error":
                    tracingLogger.error("Streaming error", { error: event.error });
                    break;
            }
        }
    }

    private handleContentEvent(
        event: { content: string },
        state: ReturnType<typeof this.initializeStreamingState>,
        streamPublisher?: StreamPublisher
    ) {
        state.fullContent += event.content;
        streamPublisher?.addContent(event.content);
    }

    private async handleToolStartEvent(
        event: { tool: string },
        streamPublisher: StreamPublisher | undefined,
        publisher: NostrPublisher | undefined,
        tracingLogger: TracingLogger
    ) {
        await streamPublisher?.flush({ isToolCall: true });

        if (publisher) {
            try {
                await publisher.publishTypingIndicator("start");
            } catch (error) {
                tracingLogger.info("Failed to publish typing indicator", {
                    tool: event.tool,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }

    private async handleToolCompleteEvent(
        event: { tool: string; result: unknown },
        state: ReturnType<typeof this.initializeStreamingState>,
        streamPublisher: StreamPublisher | undefined,
        publisher: NostrPublisher | undefined,
        tracingLogger: TracingLogger
    ) {
        const toolResult = this.extractToolResult(event);
        state.allToolResults.push(toolResult);
        
        this.processToolMetadata(toolResult, state, tracingLogger);
        
        await streamPublisher?.flush({ isToolCall: true });
        await this.stopTypingIndicator(publisher, event.tool, tracingLogger);
    }

    private extractToolResult(event: { tool: string; result: unknown }): ToolExecutionResult {
        const resultWithMetadata = event.result as
            | {
                  metadata?: unknown;
                  success?: boolean;
              }
            | null
            | undefined;

        return {
            success: true,
            output: event.result as ToolOutput,
            duration: 0,
            toolName: event.tool,
            metadata: resultWithMetadata?.metadata as
                | ToolExecutionMetadata
                | ContinueMetadata
                | CompleteMetadata
                | undefined,
        };
    }

    private processToolMetadata(
        toolResult: ToolExecutionResult,
        state: ReturnType<typeof this.initializeStreamingState>,
        tracingLogger: TracingLogger
    ) {
        if (!toolResult.metadata) return;

        const metadata = toolResult.metadata;
        if (isContinueMetadata(metadata)) {
            state.continueMetadata = metadata;
            tracingLogger.info("🔄 Continue routing detected in streaming", {
                destination: metadata.routingDecision.destination,
                destinationName: metadata.routingDecision.destinationName,
                phase: metadata.routingDecision.phase,
            });
        } else if (isCompleteMetadata(metadata)) {
            state.completeMetadata = metadata;
            tracingLogger.info("✅ Complete detected in streaming", {
                nextAgent: metadata.completion.nextAgent,
                hasResponse: !!metadata.completion.response,
            });
        }
    }

    private async stopTypingIndicator(
        publisher: NostrPublisher | undefined,
        tool: string,
        tracingLogger: TracingLogger
    ) {
        if (!publisher) return;

        try {
            await publisher.publishTypingIndicator("stop");
        } catch (error) {
            tracingLogger.info("Failed to publish typing indicator stop", {
                tool,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private handleDoneEvent(
        event: { response: CompletionResponse },
        state: ReturnType<typeof this.initializeStreamingState>,
        tracingLogger: TracingLogger
    ) {
        state.finalResponse = event.response;
        tracingLogger.debug("Received done event", {
            hasResponse: !!state.finalResponse,
            hasUsage: !!state.finalResponse?.usage,
            usage: state.finalResponse?.usage,
            model:
                "model" in state.finalResponse && typeof state.finalResponse.model === "string"
                    ? state.finalResponse.model
                    : undefined,
        });
    }

    private async finalizeStream(
        streamPublisher: StreamPublisher | undefined,
        state: ReturnType<typeof this.initializeStreamingState>,
        context: ReasonActContext,
        messages: Message[],
        tracingLogger: TracingLogger
    ) {
        if (!streamPublisher || streamPublisher.isFinalized()) return;

        const llmMetadata = await this.buildLLMMetadata(state.finalResponse, messages, tracingLogger, context);
        
        await streamPublisher.finalize({
            llmMetadata,
            continueMetadata: state.continueMetadata,
            completeMetadata: state.completeMetadata,
            nextAgent:
                context.nextAgent ||
                state.continueMetadata?.routingDecision.destination ||
                state.completeMetadata?.completion.nextAgent,
        });

        this.logStreamFinalization(state, context, tracingLogger);
    }

    private async buildLLMMetadata(
        finalResponse: CompletionResponse | undefined,
        messages: Message[],
        tracingLogger: TracingLogger,
        context: ReasonActContext
    ): Promise<LLMMetadata | undefined> {
        if (!finalResponse) {
            tracingLogger.info(
                "No final response received from stream - LLM metadata will be missing",
                {
                    agent: context.agent.name,
                }
            );
            return undefined;
        }

        const llmMetadata = await buildLLMMetadata(finalResponse, messages);
        tracingLogger.debug("Built LLM metadata for final response", {
            hasMetadata: !!llmMetadata,
            model: llmMetadata?.model,
            cost: llmMetadata?.cost,
            promptTokens: llmMetadata?.promptTokens,
            completionTokens: llmMetadata?.completionTokens,
        });
        
        return llmMetadata;
    }

    private logStreamFinalization(
        state: ReturnType<typeof this.initializeStreamingState>,
        context: ReasonActContext,
        tracingLogger: TracingLogger
    ) {
        if (state.continueMetadata) {
            tracingLogger.debug("Published final response with continue routing", {
                agent: context.agent.name,
                destination: state.continueMetadata.routingDecision.destination,
                phase: state.continueMetadata.routingDecision.phase,
            });
        } else if (state.completeMetadata) {
            tracingLogger.debug("Published final response with completion", {
                agent: context.agent.name,
                nextAgent: state.completeMetadata.completion.nextAgent,
            });
        } else {
            tracingLogger.debug("Published final response on stream completion", {
                agent: context.agent.name,
            });
        }
    }

    private createFinalEvent(state: ReturnType<typeof this.initializeStreamingState>): StreamEvent {
        return {
            type: "done",
            response: state.finalResponse || {
                content: state.fullContent,
                toolCalls: [],
            },
        } as StreamEvent;
    }

    private async *handleStreamingError(
        error: unknown,
        publisher: NostrPublisher | undefined,
        streamPublisher: StreamPublisher | undefined,
        tracingLogger: TracingLogger,
        context: ReasonActContext
    ): AsyncIterable<StreamEvent> {
        tracingLogger.error("Streaming execution failed", {
            agent: context.agent.name,
            error: error instanceof Error ? error.message : String(error),
        });

        const errorMessage = `I encountered an error while processing your request: ${
            error instanceof Error ? error.message : String(error)
        }`;

        if (publisher && streamPublisher && !streamPublisher.isFinalized()) {
            await this.publishStreamError(streamPublisher, errorMessage, tracingLogger, context);
        } else if (publisher && !streamPublisher) {
            await this.publishDirectError(publisher, errorMessage, tracingLogger, context);
        }

        yield {
            type: "error",
            error: error instanceof Error ? error.message : String(error),
        };
    }

    private async publishStreamError(
        streamPublisher: StreamPublisher,
        errorMessage: string,
        tracingLogger: TracingLogger,
        context: ReasonActContext
    ) {
        try {
            streamPublisher.addContent(errorMessage);
            await streamPublisher.finalize({});
        } catch (publishError) {
            tracingLogger.error("Failed to publish error message", {
                agent: context.agent.name,
                error:
                    publishError instanceof Error
                        ? publishError.message
                        : String(publishError),
            });
        }
    }

    private async publishDirectError(
        publisher: NostrPublisher,
        errorMessage: string,
        tracingLogger: TracingLogger,
        context: ReasonActContext
    ) {
        try {
            await publisher.publishError(errorMessage);
        } catch (publishError) {
            tracingLogger.error("Failed to publish error message", {
                agent: context.agent.name,
                error:
                    publishError instanceof Error
                        ? publishError.message
                        : String(publishError),
            });
        }
    }
}
