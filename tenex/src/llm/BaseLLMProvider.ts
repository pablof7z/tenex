import type { LLMContext, LLMMessage, LLMProvider, LLMResponse, ProviderTool } from "@/llm/types";
import type { LLMConfig } from "@/utils/agents/types";
import { logger } from "@tenex/shared/logger";
import chalk from "chalk";
import { validateLLMConfig } from "./utils/configValidation";
import { logLLMRequest, logLLMResponse, logLLMError } from "./utils/llmLogging";
import {
    LLMAuthenticationError,
    LLMProviderError,
    LLMRateLimitError,
} from "./utils/LLMProviderError";

export abstract class BaseLLMProvider implements LLMProvider {
    protected abstract readonly providerName: string;
    protected abstract readonly defaultModel: string;
    protected abstract readonly defaultBaseURL: string;

    // Public getters for testing
    get provider(): string {
        return this.providerName;
    }

    get model(): string {
        return this.defaultModel;
    }

    async generateResponse(
        messages: LLMMessage[],
        config: LLMConfig,
        context?: LLMContext,
        tools?: ProviderTool[]
    ): Promise<LLMResponse> {
        validateLLMConfig(config);

        const baseURL = config.baseURL || this.defaultBaseURL;
        const model = config.model || this.defaultModel;

        const requestBody = this.buildRequestBody(messages, config, model, tools);

        // Log request details with full prompts for orchestration
        logLLMRequest(this.providerName, messages, context, config);

        try {
            const response = await this.makeRequest(baseURL, requestBody, config);

            if (!response.ok) {
                const errorText = await response.text();
                const enhancedError = this.createProviderError(response.status, errorText, context);
                throw enhancedError;
            }

            const data = await response.json();

            // Log response summary - this keeps the "Response Telemetry" logs
            logLLMResponse(this.providerName, data, model);

            const result = this.parseResponse(data);

            return result;
        } catch (error) {
            if (error instanceof LLMProviderError) {
                logLLMError(this.providerName, error.message, {
                    provider: error.provider,
                    statusCode: error.statusCode,
                    context: error.context,
                });
            } else {
                this.handleProviderError(error, context);
            }
            throw error;
        }
    }

    protected createProviderError(
        statusCode: number,
        errorText: string,
        context?: LLMContext
    ): LLMProviderError {
        const contextInfo = context
            ? {
                  agent: context.agentName,
                  project: context.projectName,
                  conversation: context.rootEventId,
                  model: this.defaultModel,
              }
            : undefined;

        // Parse error response to get more specific error types
        let parsedError: Record<string, unknown>;
        try {
            parsedError = JSON.parse(errorText);
        } catch {
            parsedError = { message: errorText };
        }

        const errorMessage = (parsedError.error as any)?.message || (parsedError as any).message || errorText;

        switch (statusCode) {
            case 401:
                return new LLMAuthenticationError(
                    `Authentication failed: ${errorMessage}`,
                    this.providerName
                );
            case 429: {
                const retryAfter = (parsedError.error as any)?.retry_after;
                return new LLMRateLimitError(
                    `Rate limit exceeded: ${errorMessage}`,
                    this.providerName,
                    retryAfter
                );
            }
            case 400:
                return new LLMProviderError(
                    `Bad request: ${errorMessage}`,
                    this.providerName,
                    statusCode,
                    parsedError,
                    contextInfo
                );
            case 500:
            case 502:
            case 503:
            case 504:
                return new LLMProviderError(
                    `${this.providerName} server error: ${errorMessage}`,
                    this.providerName,
                    statusCode,
                    parsedError,
                    contextInfo
                );
            default:
                return new LLMProviderError(
                    `${this.providerName} API error (${statusCode}): ${errorMessage}`,
                    this.providerName,
                    statusCode,
                    parsedError,
                    contextInfo
                );
        }
    }

    protected handleProviderError(error: unknown, context?: LLMContext): void {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorDetails = {
            provider: this.providerName,
            model: this.defaultModel,
            context: context
                ? {
                      agent: context.agentName,
                      project: context.projectName,
                      conversation: context.rootEventId,
                  }
                : undefined,
        };

        logLLMError(this.providerName, errorMessage, errorDetails);
    }


    protected extractResponseContent(data: unknown): string {
        // Try to extract response content for different provider formats
        const dataAny = data as any;
        if (dataAny?.choices?.[0]?.message?.content) {
            return dataAny.choices[0].message.content;
        }
        if (dataAny?.content?.[0]?.text) {
            return dataAny.content[0].text;
        }
        if (dataAny?.message?.content) {
            return dataAny.message.content;
        }
        return "";
    }

    protected formatToolCallsAsText(toolCalls: unknown[]): string {
        let content = "";
        for (const toolCall of toolCalls) {
            const toolData = this.extractToolCallData(toolCall);
            if (toolData) {
                logger.debug("Model returned native tool call:", toolCall);
                content += `\n<tool_use>\n${JSON.stringify(
                    {
                        tool: toolData.name,
                        arguments: toolData.arguments,
                    },
                    null,
                    2
                )}\n</tool_use>`;
            }
        }
        return content;
    }

    // Abstract methods that each provider must implement
    protected abstract buildRequestBody(
        messages: LLMMessage[],
        config: LLMConfig,
        model: string,
        tools?: ProviderTool[]
    ): Record<string, unknown>;

    protected abstract makeRequest(
        baseURL: string,
        requestBody: Record<string, unknown>,
        config: LLMConfig
    ): Promise<Response>;

    protected abstract parseResponse(data: unknown): LLMResponse;

    protected abstract extractUsage(
        data: unknown
    ): { prompt_tokens?: number; completion_tokens?: number } | null;

    protected abstract extractToolCallData(
        toolCall: unknown
    ): { name: string; arguments: Record<string, unknown> } | null;
}
