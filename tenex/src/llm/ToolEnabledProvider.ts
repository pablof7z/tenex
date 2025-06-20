import type { LLMContext, LLMMessage, LLMProvider, LLMResponse, ProviderTool } from "@/llm/types";
import type { OpenAIToolCall } from "@/llm/types/responses";
import { ToolExecutor } from "@/utils/agents/tools/ToolExecutor";
import { parseToolCalls, removeToolCalls } from "@/utils/agents/tools/ToolParser";
import type { ToolRegistry } from "@/utils/agents/tools/ToolRegistry";
import type { ToolCall } from "@/utils/agents/tools/types";
import type { LLMConfig } from "@/utils/agents/types";
import { logger } from "@tenex/shared/logger";

export class ToolEnabledProvider implements LLMProvider {
    private executor: ToolExecutor;
    private lastRenderInChat?: { type: string; data: unknown };

    constructor(
        private baseProvider: LLMProvider,
        private toolRegistry: ToolRegistry,
        private providerType: "anthropic" | "openai" | "openrouter" = "anthropic"
    ) {
        this.executor = new ToolExecutor(toolRegistry);
    }

    getLastRenderInChat(): { type: string; data: unknown } | undefined {
        return this.lastRenderInChat;
    }

    clearRenderInChat(): void {
        this.lastRenderInChat = undefined;
    }

    async generateResponse(
        messages: LLMMessage[],
        config: LLMConfig,
        context?: LLMContext,
        _tools?: ProviderTool[]
    ): Promise<LLMResponse> {
        // Add tool instructions to the system message if tools are available
        const enhancedMessages = [...messages];
        const availableTools = this.toolRegistry.getAllTools();

        if (availableTools.length > 0) {
            const toolPrompt = this.toolRegistry.generateSystemPrompt();

            // Find or create system message
            const systemMessageIndex = enhancedMessages.findIndex((m) => m.role === "system");
            if (systemMessageIndex >= 0) {
                enhancedMessages[systemMessageIndex] = {
                    ...enhancedMessages[systemMessageIndex],
                    role: enhancedMessages[systemMessageIndex]?.role || "system",
                    content: `${enhancedMessages[systemMessageIndex]?.content}\n\n${toolPrompt}`,
                };
            } else {
                enhancedMessages.unshift({
                    role: "system",
                    content: toolPrompt,
                });
            }
        }

        // Convert tools to provider-specific format
        let providerTools: ProviderTool[] | undefined;
        if (availableTools.length > 0) {
            switch (this.providerType) {
                case "anthropic":
                    providerTools = this.toolRegistry.toAnthropicFormat();
                    break;
                case "openai":
                case "openrouter":
                    providerTools = this.toolRegistry.toOpenAIFormat();
                    break;
            }
        }

        // Get initial response
        const response = await this.baseProvider.generateResponse(
            enhancedMessages,
            config,
            context,
            providerTools
        );

        logger.debug("[ToolEnabledProvider] Initial response content:", response.content);

        // Check for native tool calls first (OpenAI-style function calling)
        const responseWithTools = response as LLMResponse & { tool_calls?: OpenAIToolCall[] };
        const hasNativeToolCalls =
            responseWithTools.tool_calls && responseWithTools.tool_calls.length > 0;

        // Check if the response contains text-based tool calls
        const toolCalls = parseToolCalls(response.content);
        logger.debug(
            `[ToolEnabledProvider] Parsed ${toolCalls.length} text-based tool calls:`,
            toolCalls
        );
        logger.debug(`[ToolEnabledProvider] Has native tool calls: ${hasNativeToolCalls}`);

        if (toolCalls.length === 0 && !hasNativeToolCalls) {
            // No tool calls, return the response as-is
            logger.debug("[ToolEnabledProvider] No tool calls found, returning response as-is");
            return response;
        }

        // If we're in immediate mode, return the response with tool calls for the agent to handle
        if (context?.immediateResponse) {
            return {
                ...response,
                toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                hasNativeToolCalls,
            };
        }

        // Create tool context with all necessary information
        const toolContext = {
            ...(context || {}),
            updateTypingIndicator: context?.typingIndicator,
            projectEvent: context?.projectEvent,
        };

        // Prepare tool calls for execution
        let allToolCalls = toolCalls;
        if (hasNativeToolCalls) {
            // Convert native tool calls to our format
            if (!responseWithTools.tool_calls) {
                throw new Error("Tool calls are expected but not found in response");
            }
            const nativeToolCalls = responseWithTools.tool_calls.map((tc) => ({
                id: tc.id,
                name: tc.function.name,
                arguments:
                    typeof tc.function.arguments === "string"
                        ? JSON.parse(tc.function.arguments)
                        : tc.function.arguments,
            }));
            allToolCalls = nativeToolCalls;
        }

        // Execute the tools
        logger.debug("[ToolEnabledProvider] Executing tools with context:", {
            agentName: toolContext.agentName,
            projectName: toolContext.projectName,
            toolCount: allToolCalls.length,
        });
        if (!toolContext.ndk) {
            throw new Error("NDK instance is required for tool execution but was not provided");
        }
        if (!toolContext.projectEvent) {
            throw new Error("Project event is required for tool execution but was not provided");
        }

        const toolResponses = await this.executor.executeTools(allToolCalls, {
            ...toolContext,
            ndk: toolContext.ndk,
            projectEvent: toolContext.projectEvent,
        });
        logger.debug(
            "[ToolEnabledProvider] Tool execution results:",
            toolResponses.map((r) => ({
                id: r.tool_call_id,
                outputLength: r.output?.length,
                hasOutput: !!r.output,
                hasRenderInChat: !!r.renderInChat,
            }))
        );

        // Check if any tool returned renderInChat data
        this.clearRenderInChat();
        for (const toolResponse of toolResponses) {
            if (toolResponse.renderInChat) {
                // Store the first renderInChat data found
                this.lastRenderInChat = toolResponse.renderInChat;
                logger.debug(
                    "[ToolEnabledProvider] Found renderInChat data:",
                    this.lastRenderInChat
                );
                break;
            }
        }

        // Remove tool calls from the content
        const cleanedContent = removeToolCalls(response.content);
        logger.debug(
            "[ToolEnabledProvider] Cleaned content after removing tool calls:",
            cleanedContent
        );

        // Handle text-based tool calls differently from native tool calls
        if (hasNativeToolCalls) {
            // Native function calling - prepare for second LLM call
            // Add the assistant's message with native tool calls
            enhancedMessages.push({
                role: "assistant",
                content: response.content,
                tool_calls: responseWithTools.tool_calls as any,
            });

            // Add tool responses
            for (const toolResponse of toolResponses) {
                enhancedMessages.push({
                    role: "tool",
                    content: toolResponse.output,
                    tool_call_id: toolResponse.tool_call_id,
                });
            }
        } else {
            // Text-based tool calls - embed results directly
            let finalContent = cleanedContent;

            // Add tool results to the content
            for (const toolResponse of toolResponses) {
                const toolCall = allToolCalls.find((tc) => tc.id === toolResponse.tool_call_id);
                if (toolCall) {
                    finalContent += `\n\n**Tool: ${toolCall.name}**\n${toolResponse.output}`;
                }
            }

            // Return immediately with embedded results
            return {
                ...response,
                content: finalContent,
            };
        }

        // Get the final response after tool execution
        logger.debug("[ToolEnabledProvider] Getting final response after tool execution");
        logger.debug(
            "[ToolEnabledProvider] Enhanced messages for final call:",
            enhancedMessages.map((m) => ({
                role: m.role,
                contentLength: m.content?.length,
                hasToolCalls: !!m.tool_calls,
            }))
        );

        // Add instruction to process tool results for the final response
        const finalMessages = [...enhancedMessages];
        const systemIndex = finalMessages.findIndex((m) => m.role === "system");
        if (systemIndex >= 0) {
            finalMessages[systemIndex] = {
                ...finalMessages[systemIndex],
                role: finalMessages[systemIndex]?.role || "system",
                content: `${finalMessages[systemIndex]?.content}\n\nIMPORTANT: The tools have been executed and their results are provided above. Respond naturally to the user based on the tool results. Do not call tools again.`,
            };
        }

        // Filter out consecutive messages with the same role and ensure non-empty content
        const cleanedMessages = [];
        for (const message of finalMessages) {
            // Skip messages with empty or very short content (except system messages)
            if (
                message.role !== "system" &&
                (!message.content || message.content.trim().length < 2)
            ) {
                continue;
            }

            // Skip if this message has the same role as the previous one
            const lastMessage = cleanedMessages[cleanedMessages.length - 1];
            if (lastMessage && lastMessage.role === message.role) {
                // Merge content if both are user messages
                if (message.role === "user") {
                    lastMessage.content += `\n${message.content}`;
                }
                continue;
            }

            cleanedMessages.push(message);
        }

        const finalResponse = await this.baseProvider.generateResponse(
            cleanedMessages,
            config,
            context,
            undefined // Don't send tools for the final response
        );
        logger.debug("[ToolEnabledProvider] Final response content:", finalResponse.content);

        // Clean any remaining tool calls from the final response
        const finalCleanedContent = removeToolCalls(finalResponse.content);
        finalResponse.content = finalCleanedContent;
        logger.debug("[ToolEnabledProvider] Final cleaned content:", finalCleanedContent);

        // Combine usage statistics
        if (response.usage && finalResponse.usage) {
            finalResponse.usage = {
                prompt_tokens: response.usage.prompt_tokens + finalResponse.usage.prompt_tokens,
                completion_tokens:
                    response.usage.completion_tokens + finalResponse.usage.completion_tokens,
                total_tokens: response.usage.total_tokens + finalResponse.usage.total_tokens,
                cache_creation_input_tokens:
                    (response.usage.cache_creation_input_tokens || 0) +
                    (finalResponse.usage.cache_creation_input_tokens || 0),
                cache_read_input_tokens:
                    (response.usage.cache_read_input_tokens || 0) +
                    (finalResponse.usage.cache_read_input_tokens || 0),
                cost: (response.usage.cost || 0) + (finalResponse.usage.cost || 0),
            };
        }

        return finalResponse;
    }
}
