import type { CompletionResponse, LLMService } from "@/llm/types";
import { Message } from "multi-llm-ts";
import type { TracingContext, TracingLogger } from "@/tracing";
import { createTracingLogger } from "@/tracing";
import { executeTools, parseToolUses } from "@/tools/toolExecutor";
import type { Phase } from "@/conversations/types";
import type { ToolExecutionResult } from "@/tools/types";
import { publishAgentResponse } from "@/nostr/ConversationPublisher";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { LLMMetadata } from "@/nostr/types";
import { openRouterPricing } from "@/llm/pricing";

import type { Agent } from "@/agents/types";
import type { Conversation } from "@/conversations/types";

interface ReasonActContext {
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

interface ReasonActResult {
    finalResponse: CompletionResponse;
    finalContent: string;
    toolExecutions: number;
    allToolResults?: ToolExecutionResult[]; // Array of actual tool execution results
}

export class ReasonActLoop {
    private static readonly MAX_ITERATIONS = 3;

    constructor(private llmService: LLMService) {}

    /**
     * Strip tool_use blocks from content while preserving surrounding text
     */
    private stripToolUseBlocks(content: string): string {
        // Remove all <tool_use>...</tool_use> blocks
        return content.replace(/<tool_use>[\s\S]*?<\/tool_use>/g, '').trim();
    }

    /**
     * Build LLM metadata for response tracking
     */
    private async buildLLMMetadata(
        response: CompletionResponse,
        messages: Message[]
    ): Promise<LLMMetadata | undefined> {
        if (!response.usage) {
            return undefined;
        }

        // Calculate cost based on model and token usage
        const responseWithModel = response as CompletionResponse & { model?: string };
        const cost = await this.calculateCost(
            responseWithModel.model || "unknown",
            response.usage.prompt_tokens,
            response.usage.completion_tokens
        );

        // Extract system and user prompts from messages for metadata
        const systemPrompt = messages.find(m => m.role === "system")?.content || "";
        const userMessages = messages.filter(m => m.role === "user");
        const lastUserMessage = userMessages[userMessages.length - 1];
        const userPrompt = lastUserMessage?.content || "";
        
        return {
            model: responseWithModel.model || "unknown",
            cost,
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.prompt_tokens + response.usage.completion_tokens,
            systemPrompt,
            userPrompt,
            rawResponse: response.content,
        };
    }

    /**
     * Calculate cost based on model and token usage using OpenRouter pricing
     */
    private async calculateCost(model: string, promptTokens: number, completionTokens: number): Promise<number> {
        try {
            // Try to find exact model match first
            let modelId = await openRouterPricing.findModelId(model);
            
            // If no exact match, use the model name as-is
            if (!modelId) {
                modelId = model;
            }
            
            return await openRouterPricing.calculateCost(modelId, promptTokens, completionTokens);
        } catch (error) {
            // Fallback to minimal default cost calculation
            return (promptTokens + completionTokens) / 1_000_000 * 1.0; // $1 per 1M tokens
        }
    }

    async execute(
        initialResponse: CompletionResponse,
        context: ReasonActContext,
        messages: Message[],
        tracingContext: TracingContext,
        initialLLMMetadata?: LLMMetadata
    ): Promise<ReasonActResult> {
        const tracingLogger = createTracingLogger(tracingContext, "agent");
        let currentResponse = initialResponse;
        let finalContent = currentResponse.content || "";
        let totalToolExecutions = 0;
        let iteration = 0;
        const allToolResults: ToolExecutionResult[] = [];
        
        // Work with a mutable copy of messages
        let workingMessages = [...messages];

        while (iteration < ReasonActLoop.MAX_ITERATIONS) {
            // Check if response contains tool invocations
            const hasTools = this.containsTools(currentResponse.content || "");
            
            if (!hasTools) break;

            // On first iteration with tools, publish the natural language part immediately
            if (iteration === 0 && context.eventToReply && context.agent.signer && initialLLMMetadata) {
                const strippedContent = this.stripToolUseBlocks(currentResponse.content || "");
                
                // Only publish if there's meaningful content after stripping tools
                if (strippedContent.trim()) {
                    try {
                        await publishAgentResponse(
                            context.eventToReply,
                            strippedContent,
                            context.nextAgent || "",
                            context.agent.signer,
                            initialLLMMetadata,
                            [["partial-response", "true"], ["has-tools", "true"]]
                        );
                        
                        tracingLogger.debug("Published initial response without tool blocks", {
                            agent: context.agentName,
                            contentLength: strippedContent.length
                        });
                    } catch (error) {
                        tracingLogger.error("Failed to publish initial response", {
                            agent: context.agentName,
                            error: error instanceof Error ? error.message : String(error)
                        });
                    }
                }
            }

            tracingLogger.info(`🔄 Reason-Act iteration ${iteration + 1}`, {
                agent: context.agentName,
                phase: context.phase,
                hasTools: true
            });
            
            // Execute tools and get processed content and results
            const { processedContent, toolResults } = await executeTools(currentResponse.content || "", {
                projectPath: context.projectPath,
                conversationId: context.conversationId,
                agentName: context.agentName,
                phase: context.phase,
                agent: context.agent,
                conversation: context.conversation,
            });
            
            // Collect all tool results
            allToolResults.push(...toolResults);
            
            const toolCount = this.countToolExecutions(currentResponse.content || "");
            totalToolExecutions += toolCount;
            
            // Enhanced logging for tool results
            const toolSummary = toolResults.map(r => ({
                tool: r.toolName,
                success: r.success,
                duration: r.duration,
                hasOutput: !!r.output,
                hasMetadata: !!r.metadata,
                error: r.error
            }));
            
            tracingLogger.info("📊 Tool execution results", {
                agent: context.agentName,
                iteration: iteration + 1,
                totalTools: toolCount,
                executedTools: toolResults.length,
                successful: toolResults.filter(r => r.success).length,
                failed: toolResults.filter(r => !r.success).length,
                totalDuration: toolResults.reduce((sum, r) => sum + r.duration, 0),
                tools: toolSummary
            });
            
            // Append assistant response with tool calls
            workingMessages.push(new Message("assistant", currentResponse.content || ""));
            
            // Append tool results as user message
            workingMessages.push(new Message("user", processedContent));
            
            currentResponse = await this.continueWithMessages(
                context,
                workingMessages,
                tracingLogger
            );

            finalContent = currentResponse.content || "";
            iteration++;
        }

        if (iteration >= ReasonActLoop.MAX_ITERATIONS) {
            tracingLogger.warning("Reason-Act loop reached maximum iterations", {
                agent: context.agentName,
                iterations: ReasonActLoop.MAX_ITERATIONS,
            });
            
            // Publish max iterations warning
            if (context.eventToReply) {
                await this.publishPhaseUpdate(
                    context.eventToReply,
                    `⚠️ Reached maximum iterations (${ReasonActLoop.MAX_ITERATIONS}) for ${context.agentName}`,
                    context,
                    tracingLogger
                );
            }
        } else if (context.eventToReply) {
            // Publish successful completion
            await this.publishPhaseUpdate(
                context.eventToReply,
                `🎯 Reasoning loop completed successfully after ${iteration} iterations`,
                context,
                tracingLogger
            );
        }

        return {
            finalResponse: currentResponse,
            finalContent,
            toolExecutions: totalToolExecutions,
            allToolResults,
        };
    }

    private containsTools(content: string): boolean {
        // Only check for modern JSON tool format
        return /<tool_use>/.test(content);
    }
    
    private countToolExecutions(content: string): number {
        // Only count modern JSON tool format
        const matches = content.match(/<tool_use>.*?<\/tool_use>/gs);
        return matches ? matches.length : 0;
    }

    private async continueWithMessages(
        context: ReasonActContext,
        messages: Message[],
        tracingLogger: TracingLogger
    ): Promise<CompletionResponse> {

        const response = await this.llmService.complete({
            messages,
            options: {},
        });

        // Build and publish the continuation response with LLM metadata
        if (context.eventToReply && context.agent.signer && response.content) {
            try {
                const llmMetadata = await this.buildLLMMetadata(
                    response,
                    messages
                );

                if (llmMetadata) {
                    await publishAgentResponse(
                        context.eventToReply,
                        response.content,
                        context.nextAgent || "",
                        context.agent.signer,
                        llmMetadata,
                        [["continuation-response", "true"], ["agent-phase", context.phase]]
                    );

                    tracingLogger.debug("Published continuation response with LLM metadata", {
                        agent: context.agentName,
                        model: llmMetadata.model,
                        tokens: llmMetadata.totalTokens,
                        cost: llmMetadata.cost
                    });
                }
            } catch (error) {
                tracingLogger.error("Failed to publish continuation response", {
                    agent: context.agentName,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        return response;
    }

    private async publishPhaseUpdate(
        eventToReply: NDKEvent,
        content: string,
        context: ReasonActContext,
        tracingLogger: TracingLogger
    ): Promise<void> {
        try {
            if (!context.agent.signer) {
                tracingLogger.debug("No signer available for phase update publishing");
                return;
            }

            await publishAgentResponse(
                eventToReply,
                content,
                context.nextAgent || "",
                context.agent.signer,
                undefined, // No LLM metadata for phase updates
                [["phase", "reason-act-loop"], ["agent-phase", context.phase]]
            );
            
            tracingLogger.debug("Published phase update", {
                agent: context.agentName,
                content: content.substring(0, 100) + (content.length > 100 ? "..." : "")
            });
        } catch (error) {
            tracingLogger.error("Failed to publish phase update", {
                agent: context.agentName,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}
