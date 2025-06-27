import { getDefaultToolsForAgent } from "@/agents/constants";
import type { ConversationManager } from "@/conversations/ConversationManager";
import type { Phase } from "@/conversations/phases";
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
import { getProjectContext } from "@/services";
import { getTool } from "@/tools/registry";
import type {
    ContinueMetadata,
    CompleteMetadata,
    ToolExecutionMetadata,
    ToolExecutionResult,
    ToolOutput,
    ToolResult,
} from "@/tools/types";
import { mcpService } from "@/services/mcp/MCPService";
import { isContinueMetadata, isCompleteMetadata } from "@/tools/types";
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
import "@/prompts/fragments/pm-routing";
import "@/prompts/fragments/expertise-boundaries";
import { TaskPublisher } from "@/nostr/TaskPublisher";
import { startExecutionTime, stopExecutionTime } from "@/conversations/executionTime";

export class AgentExecutor {
    private reasonActLoop: ReasonActLoop;
    private taskPublisher: TaskPublisher;

    constructor(
        private llmService: LLMService,
        private ndk: NDK,
        private conversationManager?: ConversationManager
    ) {
        this.reasonActLoop = new ReasonActLoop(llmService);
        this.taskPublisher = new TaskPublisher(this.ndk);
    }

    /**
     * Execute an agent's assignment for a conversation
     */
    async execute(
        context: AgentExecutionContext,
        triggeringEvent: NDKEvent,
        parentTracingContext?: TracingContext,
        _options?: { streaming?: boolean }
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
            agentName: context.agent.name,
            agentPubkey: context.agent.pubkey,
            phase: context.phase,
        });

        // Create NostrPublisher outside try block so it's accessible in catch
        const projectCtx = getProjectContext();
        const publisher = new NostrPublisher({
            ndk: this.ndk,
            conversation: context.conversation,
            agent: context.agent,
            triggeringEvent: triggeringEvent,
            project: projectCtx.project
        });

        try {
            // Start execution time tracking
            startExecutionTime(context.conversation);
            
            // 1. Get phase-aware tools for this agent
            const phaseAwareTools = context.agent.isPMAgent
                ? getDefaultToolsForAgent(true, context.phase)
                : context.agent.tools || getDefaultToolsForAgent(false);

            // Create a modified agent with phase-aware tools
            const agentWithPhaseTools = {
                ...context.agent,
                tools: phaseAwareTools,
            };

            // 2. Build the agent's messages
            const messages = await this.buildMessages({
                ...context,
                agent: agentWithPhaseTools,
            });

            // 3. Publish typing indicator start
            await publisher.publishTypingIndicator("start");

            // Get tools for response processing - use phase-aware tools
            const toolNames = agentWithPhaseTools.tools || [];
            const tools = toolNames.map((name) => getTool(name)).filter(Boolean) as Tool[];
            
            // Add MCP tools if available
            const mcpTools = await mcpService.getAvailableTools();
            const allTools = [...tools, ...mcpTools];

            const streamResult = await this.executeWithStreaming(
                {
                    projectPath: process.cwd(),
                    conversationId: context.conversation.id,
                    agentName: context.agent.name,
                    phase: context.phase,
                    llmConfig: context.agent.llmConfig || DEFAULT_AGENT_LLM_CONFIG,
                    agent: agentWithPhaseTools,
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
            let nextResponder: string | undefined;
            let phaseTransition: string | undefined;

            if (continueMetadata) {
                nextResponder = continueMetadata.routingDecision.destination;
                phaseTransition = continueMetadata.routingDecision.phase;

                // Handle phase transition in conversation manager
                if (this.conversationManager && phaseTransition) {
                    await this.conversationManager.updatePhase(
                        context.conversation.id,
                        phaseTransition as Phase,
                        continueMetadata.routingDecision.message,
                        context.agent.pubkey,
                        context.agent.name,
                        continueMetadata.routingDecision.reason
                    );
                }
            } else if (completeMetadata) {
                nextResponder = completeMetadata.completion.nextAgent;
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
                    nextResponder,
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
                nextAgent: nextResponder,
                sessionDurationMs: sessionDuration,
            });

            return {
                success: true,
                response: finalContent,
                llmMetadata,
                toolExecutions: allToolResults,
                nextAgent: nextResponder,
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
    private async buildMessages(context: AgentExecutionContext): Promise<Message[]> {
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

        // Add conversation history as proper messages
        const historyMessages = buildHistoryMessages(context.conversation.history);
        messages.push(...historyMessages);

        // Add current user message if needed
        if (needsCurrentUserMessage(context.conversation)) {
            const latestUserMessage = getLatestUserMessage(context.conversation);
            if (latestUserMessage) {
                messages.push(new Message("user", latestUserMessage));
            }
        }

        return messages;
    }

    /**
     * Generate initial response from LLM
     */
    private async generateResponse(
        messages: Message[],
        context: AgentExecutionContext
    ): Promise<CompletionResponse> {
        // Get tools for this agent
        const toolNames = context.agent.tools || [];
        const tools = toolNames.map((name) => getTool(name)).filter(Boolean) as Tool[];

        return await this.llmService.complete({
            messages,
            options: {},
            tools: tools.length > 0 ? tools : undefined,
            toolContext: {
                projectPath: process.cwd(),
                conversationId: context.conversation.id,
                agentName: context.agent.name,
                phase: context.phase,
                agent: context.agent,
                conversation: context.conversation,
                agentSigner: context.agent.signer,
                conversationRootEventId: context.conversation.history[0]?.id,
            },
        });
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
        tracingContext?: TracingContext,
        phaseTransition?: string
    ): Promise<NDKEvent> {
        const tracingLogger = tracingContext
            ? createTracingLogger(tracingContext, "nostr")
            : logger.forModule("nostr");

        // Check if this is a phase transition request
        const additionalTags: NDKTag[] = [];
        if (phaseTransition) {
            additionalTags.push(["phase", phaseTransition]);
        }

        // This method is now only used as a fallback - should not normally be called
        const publisher = new NostrPublisher({
            ndk: this.ndk,
            conversation: context.conversation,
            agent: context.agent,
            triggeringEvent: triggeringEvent,
            project: getProjectContext().project
        });
        
        const event = await publisher.publishResponse({
            content,
            nextAgent: nextResponder,
            llmMetadata,
            phaseTransition: phaseTransition ? { phaseTransition: { from: context.phase, to: phaseTransition as Phase, message: "" } } : undefined,
            additionalTags
        });

        if (tracingContext && "logEventPublished" in tracingLogger) {
            tracingLogger.logEventPublished(event.id || "unknown", "agent_response", {
                agentName: context.agent.name,
                preview: content.substring(0, 60),
                nextResponder,
                hasLLMMetadata: !!llmMetadata,
            });
        }

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
        let completeMetadata: CompleteMetadata | undefined;
        let wasPublished = false;

        // Process the stream - ReasonActLoop handles all publishing
        const stream = this.reasonActLoop.executeStreaming(
            context,
            messages,
            tracingContext,
            publisher,
            tools
        );

        for await (const event of stream) {
            switch (event.type) {
                case "content":
                    finalContent += event.content;
                    break;

                case "tool_complete": {
                    // Extract tool result and metadata
                    const resultWithMetadata = event.result as
                        | {
                              metadata?: unknown;
                          }
                        | null
                        | undefined;

                    const toolResult: ToolExecutionResult = {
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

                    allToolResults.push(toolResult);

                    // Check for special metadata
                    if (resultWithMetadata?.metadata) {
                        const metadata = resultWithMetadata.metadata;
                        if (isContinueMetadata(metadata)) {
                            continueMetadata = metadata;
                        } else if (isCompleteMetadata(metadata)) {
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
            response,
            messages
        );

        if (!metadata) {
            return undefined;
        }

        // Add additional metadata specific to AgentExecutor
        const responseWithModel = response as CompletionResponse & {
            contextWindow?: number;
            maxCompletionTokens?: number;
        };

        return {
            ...metadata,
            promptTokens: metadata.promptTokens,
            completionTokens: metadata.completionTokens,
            totalTokens: metadata.totalTokens,
            contextWindow: responseWithModel.contextWindow,
            maxCompletionTokens: responseWithModel.maxCompletionTokens,
            rawResponse: response.content,
        };
    }
}
