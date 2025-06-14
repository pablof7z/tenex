import { logger } from "@tenex/shared/logger";
import { ToolExecutor } from "../tools/ToolExecutor";
import { parseToolCalls, removeToolCalls } from "../tools/ToolParser";
import type { ToolRegistry } from "../tools/ToolRegistry";
import type { ToolCall } from "../tools/types";
import type { LLMConfig } from "../types";
import type { LLMContext, LLMMessage, LLMProvider, LLMResponse, ProviderTool } from "./types";

export class ToolEnabledProvider implements LLMProvider {
    private executor: ToolExecutor;

    constructor(
        private baseProvider: LLMProvider,
        private toolRegistry: ToolRegistry,
        private providerType: "anthropic" | "openai" | "openrouter" = "anthropic"
    ) {
        this.executor = new ToolExecutor(toolRegistry);
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
                    content: `${enhancedMessages[systemMessageIndex].content}\n\n${toolPrompt}`,
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

        // Check if the response contains tool calls
        const toolCalls = parseToolCalls(response.content);
        logger.debug(`[ToolEnabledProvider] Parsed ${toolCalls.length} tool calls:`, toolCalls);

        if (toolCalls.length === 0) {
            // No tool calls, return the response as-is
            logger.debug("[ToolEnabledProvider] No tool calls found, returning response as-is");
            return response;
        }

        // Create tool context with all necessary information
        const toolContext = {
            ...(context || {}),
            updateTypingIndicator: context?.typingIndicator,
            projectEvent: context?.projectEvent,
        };

        // Execute the tools
        logger.debug("[ToolEnabledProvider] Executing tools with context:", {
            agentName: toolContext.agentName,
            projectName: toolContext.projectName,
        });
        const toolResponses = await this.executor.executeTools(toolCalls, toolContext);
        logger.debug(
            "[ToolEnabledProvider] Tool execution results:",
            toolResponses.map((r) => ({
                id: r.tool_call_id,
                outputLength: r.output?.length,
                hasOutput: !!r.output,
            }))
        );

        // Remove tool calls from the content
        const cleanedContent = removeToolCalls(response.content);
        logger.debug(
            "[ToolEnabledProvider] Cleaned content after removing tool calls:",
            cleanedContent
        );

        // Add the assistant's message with tool calls (ensure non-empty content)
        enhancedMessages.push({
            role: "assistant",
            content: cleanedContent || "I used the following tools:",
            tool_calls: toolCalls,
        });

        // Add tool responses
        for (const toolResponse of toolResponses) {
            enhancedMessages.push({
                role: "tool",
                content: toolResponse.output,
                tool_call_id: toolResponse.tool_call_id,
            });
        }

        // Always send tool responses back to LLM for processing

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
                content: `${finalMessages[systemIndex].content}\n\nIMPORTANT: The tools have been executed and their results are provided above. Respond naturally to the user based on the tool results. Do not call tools again.`,
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
