import type { CompletionResponse, LLMService } from "@/llm/types";
import { Message } from "multi-llm-ts";
import type { TracingContext, TracingLogger } from "@/tracing";
import { createTracingLogger } from "@/tracing";
import { executeTools } from "@/tools/toolExecutor";
import type { Phase } from "@/conversations/types";
import { PromptBuilder } from "@/prompts";
import type { ToolExecutionResult } from "@/tools/types";

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

    async execute(
        initialResponse: CompletionResponse,
        context: ReasonActContext,
        systemPrompt: string,
        userPrompt: string,
        tracingContext: TracingContext
    ): Promise<ReasonActResult> {
        const tracingLogger = createTracingLogger(tracingContext, "agent");
        let currentResponse = initialResponse;
        let finalContent = currentResponse.content || "";
        let totalToolExecutions = 0;
        let iteration = 0;
        const allToolResults: ToolExecutionResult[] = [];

        while (iteration < ReasonActLoop.MAX_ITERATIONS) {
            // Check if response contains tool invocations
            const hasTools = this.containsTools(currentResponse.content || "");
            
            if (!hasTools) {
                tracingLogger.debug("No tool invocations found, completing Reason-Act loop", {
                    agent: context.agentName,
                    iteration,
                });
                break;
            }

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
            
            tracingLogger.info("Tool invocations completed, continuing Reason-Act loop", {
                agent: context.agentName,
                iteration,
                toolCount,
            });

            currentResponse = await this.continueWithProcessedContent(
                context,
                systemPrompt,
                userPrompt,
                currentResponse,
                processedContent,
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

    private async continueWithProcessedContent(
        context: ReasonActContext,
        systemPrompt: string,
        userPrompt: string,
        currentResponse: CompletionResponse,
        processedContent: string,
        tracingLogger: TracingLogger
    ): Promise<CompletionResponse> {
        const continuationPrompt = new PromptBuilder()
            .add("tool-continuation-prompt", { processedContent })
            .build();

        const messages: Message[] = [
            new Message("system", systemPrompt),
            new Message("user", userPrompt),
            new Message("assistant", currentResponse.content || ""),
            new Message("user", continuationPrompt),
        ];

        tracingLogger.logLLMRequest(context.llmConfig);

        const response = await this.llmService.complete({
            messages,
            options: {},
        });

        tracingLogger.logLLMResponse(context.llmConfig);

        return response;
    }
}
