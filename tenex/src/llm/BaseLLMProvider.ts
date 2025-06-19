import type { LLMContext, LLMMessage, LLMProvider, LLMResponse, ProviderTool } from "@/llm/types";
import type { LLMConfig } from "@/utils/agents/types";
import { logger } from "@tenex/shared/logger";
import chalk from "chalk";
import { ConfigValidator } from "./utils/ConfigValidator";
import { LLMLogger } from "./utils/LLMLogger";
import {
    LLMAuthenticationError,
    LLMProviderError,
    LLMRateLimitError,
} from "./utils/LLMProviderError";

export abstract class BaseLLMProvider implements LLMProvider {
    protected abstract readonly providerName: string;
    protected abstract readonly defaultModel: string;
    protected abstract readonly defaultBaseURL: string;
    protected readonly logger: LLMLogger;

    constructor() {
        // Initialize logger after the concrete class sets providerName
        this.logger = new LLMLogger(this.constructor.name.replace("Provider", ""));
    }

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
        ConfigValidator.validate(config);

        const baseURL = config.baseURL || this.defaultBaseURL;
        const model = config.model || this.defaultModel;

        const requestBody = this.buildRequestBody(messages, config, model, tools);

        // Log request details with full prompts for orchestration
        this.logger.logRequest(messages, context, config);

        try {
            const response = await this.makeRequest(baseURL, requestBody, config);

            if (!response.ok) {
                const errorText = await response.text();
                const enhancedError = this.createProviderError(response.status, errorText, context);
                throw enhancedError;
            }

            const data = await response.json();

            // Log response summary - this keeps the "Response Telemetry" logs
            this.logger.logResponse(data, model);

            const result = this.parseResponse(data);

            return result;
        } catch (error) {
            if (error instanceof LLMProviderError) {
                this.logger.logError(error.message, {
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

        const errorMessage = parsedError.error?.message || parsedError.message || errorText;

        switch (statusCode) {
            case 401:
                return new LLMAuthenticationError(
                    `Authentication failed: ${errorMessage}`,
                    this.providerName
                );
            case 429: {
                const retryAfter = parsedError.error?.retry_after;
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

        this.logger.logError(errorMessage, errorDetails);
    }

    protected logRequest(messages: LLMMessage[], context?: LLMContext, config?: LLMConfig): void {
        const userMessage = messages.find((msg) => msg.role === "user");
        const systemMessage = messages.find((msg) => msg.role === "system");

        if (context) {
            // Log LLM configuration details with colors
            if (config) {
                logger.info(chalk.blue.bold(`\n🤖 ${this.providerName} LLM Configuration:`));
                logger.info(chalk.cyan(`   Agent: ${context.agentName}`));
                logger.info(chalk.cyan(`   Model: ${config.model || this.defaultModel}`));
                logger.info(chalk.cyan(`   Base URL: ${config.baseURL || this.defaultBaseURL}`));
                logger.info(chalk.cyan(`   Max Tokens: ${config.maxTokens || "default"}`));
                logger.info(chalk.cyan(`   Temperature: ${config.temperature ?? "default"}`));

                if (config.enableCaching) {
                    logger.info(chalk.green("   Caching: enabled"));
                }
            }

            // Always show full prompts with distinctive colors
            logger.info(
                chalk.magenta.bold(`\n🚀 LLM REQUEST TO ${this.providerName.toUpperCase()}:`)
            );
            logger.info(chalk.gray(`Agent: ${context.agentName} | Messages: ${messages.length}`));

            if (systemMessage) {
                logger.info(chalk.yellow.bold("\n🔧 SYSTEM PROMPT:"));
                logger.info(chalk.yellow("═".repeat(80)));
                logger.info(chalk.white(systemMessage.content));
                logger.info(chalk.yellow("═".repeat(80)));
            }

            if (userMessage) {
                logger.info(chalk.green.bold("\n👤 USER PROMPT:"));
                logger.info(chalk.green("═".repeat(80)));
                logger.info(chalk.white(userMessage.content));
                logger.info(chalk.green("═".repeat(80)));
            }

            // Log all other messages (assistant, tool, etc.)
            const otherMessages = messages.filter(
                (msg) => msg.role !== "system" && msg.role !== "user"
            );
            if (otherMessages.length > 0) {
                logger.info(chalk.blue.bold("\n💬 OTHER MESSAGES:"));
                logger.info(chalk.blue("═".repeat(80)));
                otherMessages.forEach((msg, index) => {
                    const roleColor =
                        msg.role === "assistant"
                            ? chalk.greenBright
                            : msg.role === "tool"
                              ? chalk.magentaBright
                              : chalk.gray;
                    logger.info(
                        roleColor.bold(`Message ${index + 1} (${msg.role.toUpperCase()}):`)
                    );
                    logger.info(chalk.white(msg.content));
                    if (index < otherMessages.length - 1) {
                        logger.info(chalk.blue("─".repeat(40)));
                    }
                });
                logger.info(chalk.blue("═".repeat(80)));
            }

            // Log message summary
            logger.info(chalk.cyan.bold("\n📊 Message Summary:"));
            logger.info(chalk.cyan(`   Total messages: ${messages.length}`));
            logger.info(
                chalk.cyan(`   System message: ${systemMessage?.content?.length || 0} chars`)
            );
            logger.info(chalk.cyan(`   User message: ${userMessage?.content?.length || 0} chars`));
            logger.info(chalk.cyan(`   Other messages: ${otherMessages.length}`));
            logger.info(chalk.magenta("─".repeat(80)));
        }
    }

    protected logResponse(data: unknown, model?: string): void {
        const usage = this.extractUsage(data);
        const content = this.extractResponseContent(data);

        // Always show LLM response with colors
        logger.info(chalk.red.bold(`\n📨 LLM RESPONSE FROM ${this.providerName.toUpperCase()}:`));

        if (content) {
            logger.info(chalk.red("═".repeat(80)));
            logger.info(chalk.white(content));
            logger.info(chalk.red("═".repeat(80)));
        }

        if (usage) {
            const totalTokens = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
            logger.info(chalk.yellow.bold("\n📊 Response Telemetry:"));
            if (model) {
                logger.info(chalk.yellow(`   Model: ${model}`));
            }
            logger.info(chalk.yellow(`   Prompt tokens: ${usage.prompt_tokens || 0}`));
            logger.info(chalk.yellow(`   Completion tokens: ${usage.completion_tokens || 0}`));
            logger.info(chalk.yellow(`   Total tokens: ${totalTokens}`));

            if (content) {
                logger.info(chalk.yellow(`   Response length: ${content.length} characters`));

                // Log token efficiency
                if (totalTokens > 0) {
                    const charsPerToken = content.length / totalTokens;
                    logger.info(
                        chalk.yellow(`   Efficiency: ${charsPerToken.toFixed(2)} chars/token`)
                    );
                }
            }

            // Show cost if available
            if (data.usage?.cost) {
                logger.info(chalk.green(`   Cost: $${data.usage.cost}`));
            }

            // Show cache hit if available
            if (data.usage?.cached_tokens) {
                logger.info(chalk.green(`   Cache hit: ${data.usage.cached_tokens} tokens`));
            }
        }

        logger.info(chalk.red("─".repeat(80)));
    }

    protected extractResponseContent(data: unknown): string {
        // Try to extract response content for different provider formats
        if (data?.choices?.[0]?.message?.content) {
            return data.choices[0].message.content;
        }
        if (data?.content?.[0]?.text) {
            return data.content[0].text;
        }
        if (data?.message?.content) {
            return data.message.content;
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
