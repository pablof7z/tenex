import { logger } from "@tenex/shared/logger";

export interface ParsedToolCall {
    name: string;
    arguments: Record<string, unknown>;
    id?: string;
}

export class ToolCallParser {
    static parseAnthropicToolCall(toolCall: unknown): ParsedToolCall | null {
        try {
            if (toolCall?.type === "tool_use") {
                return {
                    name: toolCall.name,
                    arguments: toolCall.input || {},
                    id: toolCall.id,
                };
            }
        } catch (error) {
            logger.error("Failed to parse Anthropic tool call:", { error, toolCall });
        }
        return null;
    }

    static parseOpenAIToolCall(toolCall: unknown): ParsedToolCall | null {
        try {
            if (toolCall?.function) {
                return {
                    name: toolCall.function.name,
                    arguments: ToolCallParser.parseArguments(toolCall.function.arguments),
                    id: toolCall.id,
                };
            }
        } catch (error) {
            logger.error("Failed to parse OpenAI tool call:", { error, toolCall });
        }
        return null;
    }

    static parseOpenRouterToolCall(toolCall: unknown): ParsedToolCall | null {
        try {
            // OpenRouter can use either OpenAI or Anthropic format
            if (toolCall?.function) {
                return ToolCallParser.parseOpenAIToolCall(toolCall);
            }
            if (toolCall?.type === "tool_use") {
                return ToolCallParser.parseAnthropicToolCall(toolCall);
            }
        } catch (error) {
            logger.error("Failed to parse OpenRouter tool call:", { error, toolCall });
        }
        return null;
    }

    static parseOllamaToolCall(toolCall: unknown): ParsedToolCall | null {
        try {
            // Ollama typically follows OpenAI format
            if (toolCall?.function) {
                return ToolCallParser.parseOpenAIToolCall(toolCall);
            }
        } catch (error) {
            logger.error("Failed to parse Ollama tool call:", { error, toolCall });
        }
        return null;
    }

    private static parseArguments(args: string | unknown): Record<string, unknown> {
        if (typeof args === "string") {
            try {
                return JSON.parse(args);
            } catch (error) {
                logger.warn("Failed to parse tool call arguments as JSON:", { args, error });
                return { raw: args };
            }
        }
        return args || {};
    }

    static extractToolCallsByProvider(response: unknown, provider: string): ParsedToolCall[] {
        const toolCalls: ParsedToolCall[] = [];

        try {
            switch (provider.toLowerCase()) {
                case "anthropic":
                    if (response?.content) {
                        for (const content of response.content) {
                            const parsed = ToolCallParser.parseAnthropicToolCall(content);
                            if (parsed) toolCalls.push(parsed);
                        }
                    }
                    break;

                case "openai":
                    if (response?.choices?.[0]?.message?.tool_calls) {
                        for (const toolCall of response.choices[0].message.tool_calls) {
                            const parsed = ToolCallParser.parseOpenAIToolCall(toolCall);
                            if (parsed) toolCalls.push(parsed);
                        }
                    }
                    break;

                case "openrouter":
                    if (response?.choices?.[0]?.message?.tool_calls) {
                        for (const toolCall of response.choices[0].message.tool_calls) {
                            const parsed = ToolCallParser.parseOpenRouterToolCall(toolCall);
                            if (parsed) toolCalls.push(parsed);
                        }
                    }
                    break;

                case "ollama":
                    if (response?.choices?.[0]?.message?.tool_calls) {
                        for (const toolCall of response.choices[0].message.tool_calls) {
                            const parsed = ToolCallParser.parseOllamaToolCall(toolCall);
                            if (parsed) toolCalls.push(parsed);
                        }
                    }
                    break;

                default:
                    logger.warn(`Unknown provider for tool call parsing: ${provider}`);
            }
        } catch (error) {
            logger.error(`Failed to extract tool calls for provider ${provider}:`, {
                error,
                response,
            });
        }

        return toolCalls;
    }
}
