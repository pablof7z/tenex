import type { Phase } from "@/conversations/phases";
import type { CompletionResponse, LLMService, StreamEvent, Tool } from "@/llm/types";
import { publishAgentResponse } from "@/nostr/ConversationPublisher";
import { publishToolExecutionStatus } from "@/nostr/ToolExecutionPublisher";
import { getNDK } from "@/nostr/ndkClient";
import type { LLMMetadata } from "@/nostr/types";
import { buildLLMMetadata } from "@/prompts/utils/llmMetadata";
import type {
    HandoffMetadata,
    PhaseTransitionMetadata,
    ToolExecutionMetadata,
    ToolExecutionResult,
    ToolOutput,
} from "@/tools/types";
import { isHandoffMetadata, isPhaseTransitionMetadata } from "@/tools/types";
import type { TracingContext, TracingLogger } from "@/tracing";
import { createTracingLogger } from "@/tracing";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { Message } from "multi-llm-ts";
import { BufferedStreamPublisher } from "./BufferedStreamPublisher";

import type { Agent } from "@/agents/types";
import type { Conversation } from "@/conversations/types";

export interface ReasonActContext {
    projectPath: string;
    conversationId: string;
    agentName: string;
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
    handoffMetadata?: HandoffMetadata;
    phaseTransitionMetadata?: PhaseTransitionMetadata;
}

interface StreamingReasonActResult extends ReasonActResult {
    events: AsyncIterable<StreamEvent>;
}

export class ReasonActLoop {
    private static readonly MAX_ITERATIONS = 3;

    constructor(private llmService: LLMService) {}

    /**
     * Build LLM metadata for response tracking
     */
    private async buildLLMMetadata(
        response: CompletionResponse,
        messages: Message[]
    ): Promise<LLMMetadata | undefined> {
        const responseWithUsage = {
            usage: response.usage
                ? {
                      promptTokens: response.usage.prompt_tokens,
                      completionTokens: response.usage.completion_tokens,
                      totalTokens: response.usage.prompt_tokens + response.usage.completion_tokens,
                  }
                : undefined,
            model:
                "model" in response && typeof response.model === "string"
                    ? response.model
                    : undefined,
            experimental_providerMetadata:
                "experimental_providerMetadata" in response
                    ? (response.experimental_providerMetadata as {
                          openrouter?: { usage?: { total_cost?: number } };
                      })
                    : undefined,
        };

        const metadata = await buildLLMMetadata(
            responseWithUsage,
            responseWithUsage.model || "unknown",
            messages
        );

        if (!metadata) {
            return undefined;
        }

        // Add additional metadata specific to ReasonActLoop
        const responseWithModel = response as CompletionResponse & {
            contextWindow?: number;
            maxCompletionTokens?: number;
        };

        return {
            ...metadata,
            promptTokens: metadata.usage.prompt_tokens,
            completionTokens: metadata.usage.completion_tokens,
            totalTokens: metadata.usage.total_tokens,
            contextWindow: responseWithModel.contextWindow,
            maxCompletionTokens: responseWithModel.maxCompletionTokens,
            rawResponse: response.content,
        };
    }

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
        let handoffMetadata: HandoffMetadata | undefined;
        let phaseTransitionMetadata: PhaseTransitionMetadata | undefined;

        // Native function calls are already executed by multi-llm-ts
        if (initialResponse.toolCalls && initialResponse.toolCalls.length > 0) {
            tracingLogger.info("📊 Native tool execution results", {
                agent: context.agentName,
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
                    if (isHandoffMetadata(toolCall.result.metadata)) {
                        handoffMetadata = toolCall.result.metadata;
                    } else if (isPhaseTransitionMetadata(toolCall.result.metadata)) {
                        phaseTransitionMetadata = toolCall.result.metadata;
                    }
                }
            }

            // Publish the response with tool results
            if (context.eventToReply && context.agent.signer && initialLLMMetadata) {
                try {
                    await publishAgentResponse(
                        context.eventToReply,
                        initialResponse.content || "",
                        context.nextAgent || "",
                        context.agent.signer,
                        initialLLMMetadata,
                        [
                            ["has-tools", "true"],
                            ["tool-count", String(initialResponse.toolCalls.length)],
                        ]
                    );

                    tracingLogger.debug("Published response with native tool calls", {
                        agent: context.agentName,
                        toolCount: initialResponse.toolCalls.length,
                    });
                } catch (error) {
                    tracingLogger.error("Failed to publish response", {
                        agent: context.agentName,
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
            handoffMetadata,
            phaseTransitionMetadata,
        };
    }

    async *executeStreaming(
        context: ReasonActContext,
        messages: Message[],
        tracingContext: TracingContext,
        tools?: Tool[]
    ): AsyncIterable<StreamEvent> {
        const tracingLogger = createTracingLogger(tracingContext, "agent");
        const allToolResults: ToolExecutionResult[] = [];
        let handoffMetadata: HandoffMetadata | undefined;
        let phaseTransitionMetadata: PhaseTransitionMetadata | undefined;
        let finalResponse: CompletionResponse | undefined;
        let fullContent = "";

        tracingLogger.info("🔄 Starting streaming execution", {
            agent: context.agentName,
            phase: context.phase,
            hasTools: !!(tools && tools.length > 0),
        });

        try {
            // Stream the response
            const stream = this.llmService.stream({
                messages,
                options: {
                    configName: context.llmConfig,
                    agentName: context.agentName,
                },
                tools,
                toolContext: {
                    projectPath: context.projectPath,
                    conversationId: context.conversationId,
                    agentName: context.agentName,
                    phase: context.phase,
                    agent: context.agent,
                    conversation: context.conversation,
                    agentSigner: context.agent.signer,
                    conversationRootEventId: context.conversation.history[0]?.id,
                },
            });

            // Create buffered publisher for streaming
            const streamPublisher = new BufferedStreamPublisher(
                context.eventToReply,
                context.agent
            );

            for await (const event of stream) {
                console.log(event);
                // Pass through all events
                yield event;

                // Process events for our internal state
                switch (event.type) {
                    case "content":
                        fullContent += event.content;
                        streamPublisher.addContent(event.content);
                        break;

                    case "tool_start":
                        // Flush any buffered content before starting tool
                        await streamPublisher.flush(true);

                        // Publish tool start status if we have event context
                        if (context.eventToReply && context.agent.signer) {
                            try {
                                const ndk = getNDK();
                                await publishToolExecutionStatus(
                                    ndk,
                                    context.eventToReply,
                                    {
                                        tool: event.tool,
                                        status: "starting",
                                        args: event.args,
                                    },
                                    context.agent.signer
                                );
                            } catch (error) {
                                tracingLogger.info("Failed to publish tool start status", {
                                    tool: event.tool,
                                    error: error instanceof Error ? error.message : String(error),
                                });
                            }
                        }
                        break;

                    case "tool_complete": {
                        // Extract tool result and metadata
                        const resultWithMetadata = event.result as
                            | {
                                  metadata?: unknown;
                                  success?: boolean;
                              }
                            | null
                            | undefined;

                        const toolResult: ToolExecutionResult = {
                            success: true,
                            output: event.result as ToolOutput,
                            duration: 0, // Native calls don't provide duration
                            toolName: event.tool,
                            metadata: resultWithMetadata?.metadata as
                                | ToolExecutionMetadata
                                | HandoffMetadata
                                | PhaseTransitionMetadata
                                | undefined,
                        };

                        allToolResults.push(toolResult);

                        // Publish tool completion status
                        if (context.eventToReply && context.agent.signer) {
                            try {
                                const ndk = getNDK();
                                await publishToolExecutionStatus(
                                    ndk,
                                    context.eventToReply,
                                    {
                                        tool: event.tool,
                                        status: "completed",
                                        result: resultWithMetadata?.success ? "Success" : "Failed",
                                    },
                                    context.agent.signer
                                );
                            } catch (error) {
                                tracingLogger.info("Failed to publish tool completion status", {
                                    tool: event.tool,
                                    error: error instanceof Error ? error.message : String(error),
                                });
                            }
                        }

                        // Check for special metadata
                        if (resultWithMetadata?.metadata) {
                            const metadata = resultWithMetadata.metadata;
                            if (isHandoffMetadata(metadata)) {
                                handoffMetadata = metadata;
                                tracingLogger.info("🤝 Handoff detected in streaming", {
                                    to: metadata.handoff.to,
                                    toName: metadata.handoff.toName,
                                });
                            } else if (isPhaseTransitionMetadata(metadata)) {
                                phaseTransitionMetadata = metadata;
                                tracingLogger.info("🔄 Phase transition detected in streaming", {
                                    from: metadata.phaseTransition.from,
                                    to: metadata.phaseTransition.to,
                                });
                            }
                        }
                        break;
                    }

                    case "done":
                        finalResponse = event.response;
                        break;

                    case "error":
                        tracingLogger.error("Streaming error", { error: event.error });
                        break;
                }
            }

            // Flush any remaining content in the buffer
            if (streamPublisher.hasContent()) {
                await streamPublisher.flush(false);
            }

            // If we have a next agent or phase transition, publish the response
            if (
                (context.nextAgent || phaseTransitionMetadata) &&
                finalResponse &&
                context.eventToReply
            ) {
                try {
                    await publishAgentResponse(
                        context.eventToReply,
                        fullContent,
                        context.nextAgent || handoffMetadata?.handoff.to || "",
                        context.agent.signer,
                        await this.buildLLMMetadata(finalResponse, messages),
                        phaseTransitionMetadata
                            ? [["phase", phaseTransitionMetadata.phaseTransition.to]]
                            : []
                    );

                    tracingLogger.debug("Published streaming response", {
                        agent: context.agentName,
                        hasHandoff: !!handoffMetadata,
                        hasPhaseTransition: !!phaseTransitionMetadata,
                    });
                } catch (error) {
                    tracingLogger.error("Failed to publish streaming response", {
                        agent: context.agentName,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }

            // Yield a final summary event with metadata
            yield {
                type: "done",
                response: finalResponse || {
                    content: fullContent,
                    toolCalls: [],
                },
            } as StreamEvent;
        } catch (error) {
            tracingLogger.error("Streaming execution failed", {
                agent: context.agentName,
                error: error instanceof Error ? error.message : String(error),
            });

            yield {
                type: "error",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
