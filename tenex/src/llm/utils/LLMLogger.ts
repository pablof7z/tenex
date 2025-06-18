import type { LLMContext, LLMMessage, LLMResponse } from "@/llm/types";
import type { LLMConfig } from "@/utils/agents/types";
import { logger } from "@tenex/shared/logger";
import chalk from "chalk";

export interface RequestSummary {
    agent?: string;
    messageCount: number;
    systemPromptLength: number;
    userPromptLength: number;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    hasTools?: boolean;
    toolCount?: number;
}

export interface ResponseSummary {
    content?: string;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
    };
    model?: string;
    hasToolCalls?: boolean;
    toolCallCount?: number;
}

export class LLMLogger {
    private static verboseMode = false;

    constructor(private providerName: string) {}

    static setVerboseMode(enabled: boolean): void {
        LLMLogger.verboseMode = enabled;
    }

    static isVerboseMode(): boolean {
        return LLMLogger.verboseMode;
    }

    logRequest(messages: LLMMessage[], context?: LLMContext, config?: LLMConfig): void {
        if (!this.shouldLog()) return;

        const summary = this.createRequestSummary(messages, context, config);

        if (context) {
            this.logConfiguration(config, context);
            this.logRequestHeader(summary);

            if (LLMLogger.isVerboseMode()) {
                this.logDetailedMessages(messages);
            }

            this.logRequestSummary(summary);
        }
    }

    logResponse(response: any, model?: string): void {
        if (!this.shouldLog()) return;

        const summary = this.createResponseSummary(response, model);
        this.logResponseContent(summary);
        this.logResponseTelemetry(summary);
    }

    private shouldLog(): boolean {
        return true; // Could be configurable based on log level
    }

    private createRequestSummary(
        messages: LLMMessage[],
        context?: LLMContext,
        config?: LLMConfig
    ): RequestSummary {
        const systemMessage = messages.find((m) => m.role === "system");
        const userMessage = messages.find((m) => m.role === "user");

        return {
            agent: context?.agentName,
            messageCount: messages.length,
            systemPromptLength: systemMessage?.content?.length || 0,
            userPromptLength: userMessage?.content?.length || 0,
            model: config?.model,
            temperature: config?.temperature,
            maxTokens: config?.maxTokens,
            hasTools: Boolean(config && "tools" in config && config.tools),
            toolCount:
                config && "tools" in config && Array.isArray(config.tools)
                    ? config.tools.length
                    : 0,
        };
    }

    private createResponseSummary(response: any, model?: string): ResponseSummary {
        return {
            content: this.extractResponseContent(response),
            usage: this.extractUsage(response),
            model,
            hasToolCalls: this.hasToolCalls(response),
            toolCallCount: this.countToolCalls(response),
        };
    }

    private logConfiguration(config?: LLMConfig, context?: LLMContext): void {
        if (!config || !context) return;

        logger.info(chalk.blue.bold(`\n🤖 ${this.providerName} LLM Configuration:`));
        logger.info(chalk.cyan(`   Agent: ${context.agentName}`));
        logger.info(chalk.cyan(`   Model: ${config.model || "default"}`));
        logger.info(chalk.cyan(`   Base URL: ${config.baseURL || "default"}`));
        logger.info(chalk.cyan(`   Max Tokens: ${config.maxTokens || "default"}`));
        logger.info(chalk.cyan(`   Temperature: ${config.temperature ?? "default"}`));

        if (config.enableCaching) {
            logger.info(chalk.green("   Caching: enabled"));
        }
    }

    private logRequestHeader(summary: RequestSummary): void {
        logger.info(chalk.magenta.bold(`\n🚀 LLM REQUEST TO ${this.providerName.toUpperCase()}:`));
        logger.info(chalk.gray(`Agent: ${summary.agent} | Messages: ${summary.messageCount}`));
    }

    private logDetailedMessages(messages: LLMMessage[]): void {
        const systemMessage = messages.find((m) => m.role === "system");
        const userMessage = messages.find((m) => m.role === "user");
        const otherMessages = messages.filter((m) => m.role !== "system" && m.role !== "user");

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

        if (otherMessages.length > 0) {
            logger.info(chalk.blue.bold("\n💬 OTHER MESSAGES:"));
            logger.info(chalk.blue("═".repeat(80)));
            otherMessages.forEach((msg, index) => {
                const roleColor = this.getRoleColor(msg.role);
                logger.info(roleColor.bold(`Message ${index + 1} (${msg.role.toUpperCase()}):`));
                logger.info(chalk.white(msg.content));
                if (index < otherMessages.length - 1) {
                    logger.info(chalk.blue("─".repeat(40)));
                }
            });
            logger.info(chalk.blue("═".repeat(80)));
        }
    }

    private logRequestSummary(summary: RequestSummary): void {
        logger.info(chalk.cyan.bold("\n📊 Message Summary:"));
        logger.info(chalk.cyan(`   Total messages: ${summary.messageCount}`));
        logger.info(chalk.cyan(`   System message: ${summary.systemPromptLength} chars`));
        logger.info(chalk.cyan(`   User message: ${summary.userPromptLength} chars`));

        const otherCount =
            summary.messageCount -
            (summary.systemPromptLength > 0 ? 1 : 0) -
            (summary.userPromptLength > 0 ? 1 : 0);
        logger.info(chalk.cyan(`   Other messages: ${otherCount}`));

        if (summary.hasTools) {
            logger.info(chalk.cyan(`   Tools available: ${summary.toolCount}`));
        }

        logger.info(chalk.magenta("─".repeat(80)));
    }

    private logResponseContent(summary: ResponseSummary): void {
        logger.info(chalk.red.bold(`\n📨 LLM RESPONSE FROM ${this.providerName.toUpperCase()}:`));

        if (summary.content) {
            logger.info(chalk.red("═".repeat(80)));
            logger.info(chalk.white(summary.content));
            logger.info(chalk.red("═".repeat(80)));
        }

        if (summary.hasToolCalls) {
            logger.info(chalk.magenta(`\n🔧 Tool calls detected: ${summary.toolCallCount}`));
        }
    }

    private logResponseTelemetry(summary: ResponseSummary): void {
        if (!summary.usage) return;

        const totalTokens =
            (summary.usage.prompt_tokens || 0) + (summary.usage.completion_tokens || 0);

        logger.info(chalk.yellow.bold("\n📊 Response Telemetry:"));
        if (summary.model) {
            logger.info(chalk.yellow(`   Model: ${summary.model}`));
        }
        logger.info(chalk.yellow(`   Prompt tokens: ${summary.usage.prompt_tokens || 0}`));
        logger.info(chalk.yellow(`   Completion tokens: ${summary.usage.completion_tokens || 0}`));
        logger.info(chalk.yellow(`   Total tokens: ${totalTokens}`));

        // Log cache-specific metrics if available
        if (summary.usage.cache_creation_input_tokens) {
            logger.info(
                chalk.green(
                    `   Cache creation tokens: ${summary.usage.cache_creation_input_tokens}`
                )
            );
        }
        if (summary.usage.cache_read_input_tokens) {
            logger.info(
                chalk.green(`   Cache read tokens: ${summary.usage.cache_read_input_tokens}`)
            );
        }

        logger.info(chalk.magenta("─".repeat(80)));
    }

    private getRoleColor(role: string): typeof chalk.greenBright {
        switch (role) {
            case "assistant":
                return chalk.greenBright;
            case "tool":
                return chalk.magentaBright;
            default:
                return chalk.gray;
        }
    }

    private extractResponseContent(response: any): string | undefined {
        // Handle Anthropic format
        if (response?.content) {
            if (Array.isArray(response.content)) {
                return response.content
                    .filter((c: any) => c.type === "text")
                    .map((c: any) => c.text)
                    .join("\n");
            }
            if (typeof response.content === "string") {
                return response.content;
            }
        }

        // Handle OpenAI format
        if (response?.choices?.[0]?.message?.content) {
            return response.choices[0].message.content;
        }

        return undefined;
    }

    private extractUsage(response: any): ResponseSummary["usage"] | undefined {
        if (response?.usage) {
            return {
                prompt_tokens: response.usage.prompt_tokens || response.usage.input_tokens,
                completion_tokens: response.usage.completion_tokens || response.usage.output_tokens,
                total_tokens: response.usage.total_tokens,
                cache_creation_input_tokens: response.usage.cache_creation_input_tokens,
                cache_read_input_tokens: response.usage.cache_read_input_tokens,
            };
        }
        return undefined;
    }

    private hasToolCalls(response: any): boolean {
        // Anthropic format
        if (response?.content) {
            return (
                Array.isArray(response.content) &&
                response.content.some((c: any) => c.type === "tool_use")
            );
        }

        // OpenAI format
        if (response?.choices?.[0]?.message?.tool_calls) {
            return response.choices[0].message.tool_calls.length > 0;
        }

        return false;
    }

    private countToolCalls(response: any): number {
        // Anthropic format
        if (response?.content) {
            return Array.isArray(response.content)
                ? response.content.filter((c: any) => c.type === "tool_use").length
                : 0;
        }

        // OpenAI format
        if (response?.choices?.[0]?.message?.tool_calls) {
            return response.choices[0].message.tool_calls.length;
        }

        return 0;
    }

    logError(errorMessage: string, errorDetails?: any): void {
        logger.error(`${this.providerName} provider error: ${errorMessage}`, errorDetails);
    }
}
