import { logger } from "@tenex/shared/logger";

export interface ParsedToolCall {
    name: string;
    arguments: Record<string, unknown>;
    id?: string;
}

export class ToolCallParser {
    static parseAnthropicToolCall(toolCall: unknown): ParsedToolCall | null {
        try {
            if (typeof toolCall !== "object" || toolCall === null) {
                return null;
            }
            const tc = toolCall as Record<string, unknown>;
            if (tc.type === "tool_use" && typeof tc.name === "string") {
                return {
                    name: tc.name,
                    arguments:
                        typeof tc.input === "object" && tc.input !== null
                            ? (tc.input as Record<string, unknown>)
                            : {},
                    id: typeof tc.id === "string" ? tc.id : undefined,
                };
            }
        } catch (error) {
            logger.error("Failed to parse Anthropic tool call:", { error, toolCall });
        }
        return null;
    }

    static parseOpenAIToolCall(toolCall: unknown): ParsedToolCall | null {
        try {
            if (typeof toolCall !== "object" || toolCall === null) {
                return null;
            }
            const tc = toolCall as Record<string, unknown>;
            if (typeof tc.function === "object" && tc.function !== null) {
                const func = tc.function as Record<string, unknown>;
                if (typeof func.name === "string") {
                    return {
                        name: func.name,
                        arguments: ToolCallParser.parseArguments(func.arguments),
                        id: typeof tc.id === "string" ? tc.id : undefined,
                    };
                }
            }
        } catch (error) {
            logger.error("Failed to parse OpenAI tool call:", { error, toolCall });
        }
        return null;
    }

    static parseOpenRouterToolCall(toolCall: unknown): ParsedToolCall | null {
        try {
            if (typeof toolCall !== "object" || toolCall === null) {
                return null;
            }
            const tc = toolCall as Record<string, unknown>;
            // OpenRouter can use either OpenAI or Anthropic format
            if (typeof tc.function === "object" && tc.function !== null) {
                return ToolCallParser.parseOpenAIToolCall(toolCall);
            }
            if (tc.type === "tool_use") {
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
            return ToolCallParser.parseOpenAIToolCall(toolCall);
        } catch (error) {
            logger.error("Failed to parse Ollama tool call:", { error, toolCall });
        }
        return null;
    }

    private static parseArguments(args: unknown): Record<string, unknown> {
        if (typeof args === "string") {
            try {
                const parsed = JSON.parse(args);
                if (typeof parsed === "object" && parsed !== null) {
                    return parsed as Record<string, unknown>;
                }
                return { raw: args };
            } catch (error) {
                logger.warn("Failed to parse tool call arguments as JSON:", { args, error });
                return { raw: args };
            }
        }
        if (typeof args === "object" && args !== null) {
            return args as Record<string, unknown>;
        }
        return {};
    }

    static extractToolCallsByProvider(response: unknown, provider: string): ParsedToolCall[] {
        const toolCalls: ParsedToolCall[] = [];

        try {
            if (typeof response !== "object" || response === null) {
                return toolCalls;
            }
            const resp = response as Record<string, unknown>;

            switch (provider.toLowerCase()) {
                case "anthropic":
                    if (Array.isArray(resp.content)) {
                        for (const content of resp.content) {
                            const parsed = ToolCallParser.parseAnthropicToolCall(content);
                            if (parsed) toolCalls.push(parsed);
                        }
                    }
                    break;

                case "openai":
                    if (Array.isArray(resp.choices) && resp.choices.length > 0) {
                        const choice = resp.choices[0] as Record<string, unknown>;
                        const message = choice.message as Record<string, unknown> | undefined;
                        if (message && Array.isArray(message.tool_calls)) {
                            for (const toolCall of message.tool_calls) {
                                const parsed = ToolCallParser.parseOpenAIToolCall(toolCall);
                                if (parsed) toolCalls.push(parsed);
                            }
                        }
                    }
                    break;

                case "openrouter":
                    if (Array.isArray(resp.choices) && resp.choices.length > 0) {
                        const choice = resp.choices[0] as Record<string, unknown>;
                        const message = choice.message as Record<string, unknown> | undefined;
                        if (message && Array.isArray(message.tool_calls)) {
                            for (const toolCall of message.tool_calls) {
                                const parsed = ToolCallParser.parseOpenRouterToolCall(toolCall);
                                if (parsed) toolCalls.push(parsed);
                            }
                        }
                    }
                    break;

                case "ollama":
                    if (Array.isArray(resp.choices) && resp.choices.length > 0) {
                        const choice = resp.choices[0] as Record<string, unknown>;
                        const message = choice.message as Record<string, unknown> | undefined;
                        if (message && Array.isArray(message.tool_calls)) {
                            for (const toolCall of message.tool_calls) {
                                const parsed = ToolCallParser.parseOllamaToolCall(toolCall);
                                if (parsed) toolCalls.push(parsed);
                            }
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
