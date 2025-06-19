import type { LLMMessage, ProviderTool } from "@/llm/types";
import type { LLMConfig } from "@/utils/agents/types";

// Anthropic content can be text or structured objects for multimodal
type AnthropicContent = string | Array<{ type: string; text?: string; [key: string]: unknown }>;

// OpenRouter-specific config extensions
interface OpenRouterConfig extends LLMConfig {
    transforms?: unknown[];
    models?: string[];
    route?: string;
}

export interface MessageFormatter {
    formatMessages(
        messages: LLMMessage[],
        config: LLMConfig,
        tools?: ProviderTool[]
    ): FormattedRequest;
}

export interface FormattedMessage {
    role: string;
    content: string | AnthropicContent;
}

export interface FormattedRequest {
    messages?: FormattedMessage[];
    system?: string | AnthropicContent;
    model: string;
    max_tokens?: number;
    temperature?: number;
    tools?: ProviderTool[];
    [key: string]: unknown;
}

export class AnthropicMessageFormatter implements MessageFormatter {
    formatMessages(
        messages: LLMMessage[],
        config: LLMConfig,
        tools?: ProviderTool[]
    ): FormattedRequest {
        // Separate system message from conversation messages
        const systemMessage = messages.find((m) => m.role === "system");
        const conversationMessages = messages.filter((m) => m.role !== "system");

        const request: FormattedRequest = {
            model: config.model || "claude-3-opus-20240229",
            max_tokens: config.maxTokens || 4096,
            temperature: config.temperature ?? 1.0,
            messages: conversationMessages.map((msg) => ({
                role: msg.role,
                content: msg.content,
            })),
        };

        if (systemMessage) {
            request.system = systemMessage.content;
        }

        if (tools && tools.length > 0) {
            request.tools = tools.map((tool) => {
                if ("input_schema" in tool) {
                    // Already an AnthropicTool
                    return tool;
                }
                // Convert from OpenAITool
                return {
                    name: tool.function.name,
                    description: tool.function.description,
                    input_schema: tool.function.parameters,
                };
            });
        }

        return request;
    }
}

export class OpenAIMessageFormatter implements MessageFormatter {
    formatMessages(
        messages: LLMMessage[],
        config: LLMConfig,
        tools?: ProviderTool[]
    ): FormattedRequest {
        const request: FormattedRequest = {
            model: config.model || "gpt-4",
            max_tokens: config.maxTokens || 4096,
            temperature: config.temperature ?? 1.0,
            messages: messages.map((msg) => ({
                role: msg.role,
                content: msg.content,
            })),
        };

        if (tools && tools.length > 0) {
            request.tools = tools.map((tool) => {
                if ("function" in tool) {
                    // Already an OpenAITool
                    return tool;
                }
                // Convert from AnthropicTool
                return {
                    type: "function" as const,
                    function: {
                        name: tool.name,
                        description: tool.description,
                        parameters: tool.input_schema,
                    },
                };
            });
            request.tool_choice = "auto";
        }

        return request;
    }
}

export class OpenRouterMessageFormatter implements MessageFormatter {
    formatMessages(
        messages: LLMMessage[],
        config: LLMConfig,
        tools?: ProviderTool[]
    ): FormattedRequest {
        // OpenRouter generally follows OpenAI format but with some extensions
        const baseRequest = new OpenAIMessageFormatter().formatMessages(messages, config, tools);

        // Add OpenRouter-specific fields if they exist in config
        const openRouterConfig = config as OpenRouterConfig;
        if (openRouterConfig.transforms) {
            baseRequest.transforms = openRouterConfig.transforms;
        }

        if (openRouterConfig.models) {
            baseRequest.models = openRouterConfig.models;
        }

        if (openRouterConfig.route) {
            baseRequest.route = openRouterConfig.route;
        }

        return baseRequest;
    }
}

export class OllamaMessageFormatter implements MessageFormatter {
    formatMessages(
        messages: LLMMessage[],
        config: LLMConfig,
        tools?: ProviderTool[]
    ): FormattedRequest {
        // Ollama follows OpenAI chat completions format
        const request: FormattedRequest = {
            model: config.model || "llama3.2",
            messages: messages.map((msg) => ({
                role: msg.role,
                content: msg.content,
            })),
            stream: false,
        };

        if (config.temperature !== undefined) {
            request.temperature = config.temperature;
        }

        if (config.maxTokens) {
            request.max_tokens = config.maxTokens;
        }

        if (tools && tools.length > 0) {
            request.tools = tools.map((tool) => {
                if ("function" in tool) {
                    // Already an OpenAITool
                    return tool;
                }
                // Convert from AnthropicTool
                return {
                    type: "function" as const,
                    function: {
                        name: tool.name,
                        description: tool.description,
                        parameters: tool.input_schema,
                    },
                };
            });
        }

        return request;
    }
}

export class MessageFormatterFactory {
    private static formatters: Map<string, MessageFormatter> = new Map([
        ["anthropic", new AnthropicMessageFormatter()],
        ["openai", new OpenAIMessageFormatter()],
        ["openrouter", new OpenRouterMessageFormatter()],
        ["ollama", new OllamaMessageFormatter()],
    ]);

    static getFormatter(provider: string): MessageFormatter {
        const formatter = MessageFormatterFactory.formatters.get(provider.toLowerCase());
        if (!formatter) {
            throw new Error(`No message formatter found for provider: ${provider}`);
        }
        return formatter;
    }

    static registerFormatter(provider: string, formatter: MessageFormatter): void {
        MessageFormatterFactory.formatters.set(provider.toLowerCase(), formatter);
    }

    static getSupportedProviders(): string[] {
        return Array.from(MessageFormatterFactory.formatters.keys());
    }
}
