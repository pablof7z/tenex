import type { LLMContext, LLMMessage, LLMResponse } from "@/llm/types";
import type { LLMConfig } from "@/utils/agents/types";
import { logger } from "@tenex/shared/logger";

const llmLogger = logger.forModule("llm");
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

  logResponse(response: unknown, model?: string): void {
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
        config && "tools" in config && Array.isArray(config.tools) ? config.tools.length : 0,
    };
  }

  private createResponseSummary(response: unknown, model?: string): ResponseSummary {
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

    llmLogger.info(chalk.blue.bold(`\n🤖 ${this.providerName} LLM Configuration:`), "verbose");
    llmLogger.info(chalk.cyan(`   Agent: ${context.agentName}`), "verbose");
    llmLogger.info(chalk.cyan(`   Model: ${config.model || "default"}`), "verbose");
    llmLogger.info(chalk.cyan(`   Base URL: ${config.baseURL || "default"}`), "verbose");
    llmLogger.info(chalk.cyan(`   Max Tokens: ${config.maxTokens || "default"}`), "verbose");
    llmLogger.info(chalk.cyan(`   Temperature: ${config.temperature ?? "default"}`), "verbose");

    if (config.enableCaching) {
      llmLogger.info(chalk.green("   Caching: enabled"), "verbose");
    }
  }

  private logRequestHeader(summary: RequestSummary): void {
    llmLogger.info(
      chalk.magenta.bold(`\n🚀 LLM REQUEST TO ${this.providerName.toUpperCase()}:`),
      "verbose"
    );
    llmLogger.info(
      chalk.gray(`Agent: ${summary.agent} | Messages: ${summary.messageCount}`),
      "verbose"
    );
  }

  private logDetailedMessages(messages: LLMMessage[]): void {
    const systemMessage = messages.find((m) => m.role === "system");
    const userMessage = messages.find((m) => m.role === "user");
    const otherMessages = messages.filter((m) => m.role !== "system" && m.role !== "user");

    if (systemMessage) {
      llmLogger.info(chalk.yellow.bold("\n🔧 SYSTEM PROMPT:"), "debug");
      llmLogger.info(chalk.yellow("═".repeat(80)), "debug");
      llmLogger.info(chalk.white(systemMessage.content), "debug");
      llmLogger.info(chalk.yellow("═".repeat(80)), "debug");
    }

    if (userMessage) {
      llmLogger.info(chalk.green.bold("\n👤 USER PROMPT:"), "debug");
      llmLogger.info(chalk.green("═".repeat(80)), "debug");
      llmLogger.info(chalk.white(userMessage.content), "debug");
      llmLogger.info(chalk.green("═".repeat(80)), "debug");
    }

    if (otherMessages.length > 0) {
      llmLogger.info(chalk.blue.bold("\n💬 OTHER MESSAGES:"), "debug");
      llmLogger.info(chalk.blue("═".repeat(80)), "debug");
      otherMessages.forEach((msg, index) => {
        const roleColor = this.getRoleColor(msg.role);
        llmLogger.info(
          roleColor.bold(`Message ${index + 1} (${msg.role.toUpperCase()}):`),
          "debug"
        );
        llmLogger.info(chalk.white(msg.content), "debug");
        if (index < otherMessages.length - 1) {
          llmLogger.info(chalk.blue("─".repeat(40)), "debug");
        }
      });
      llmLogger.info(chalk.blue("═".repeat(80)), "debug");
    }
  }

  private logRequestSummary(summary: RequestSummary): void {
    llmLogger.info(chalk.cyan.bold("\n📊 Message Summary:"), "verbose");
    llmLogger.info(chalk.cyan(`   Total messages: ${summary.messageCount}`), "verbose");
    llmLogger.info(chalk.cyan(`   System message: ${summary.systemPromptLength} chars`), "verbose");
    llmLogger.info(chalk.cyan(`   User message: ${summary.userPromptLength} chars`), "verbose");

    const otherCount =
      summary.messageCount -
      (summary.systemPromptLength > 0 ? 1 : 0) -
      (summary.userPromptLength > 0 ? 1 : 0);
    llmLogger.info(chalk.cyan(`   Other messages: ${otherCount}`), "verbose");

    if (summary.hasTools) {
      llmLogger.info(chalk.cyan(`   Tools available: ${summary.toolCount}`), "verbose");
    }

    llmLogger.info(chalk.magenta("─".repeat(80)), "verbose");
  }

  private logResponseContent(summary: ResponseSummary): void {
    llmLogger.info(
      chalk.red.bold(`\n📨 LLM RESPONSE FROM ${this.providerName.toUpperCase()}:`),
      "verbose"
    );

    if (summary.content) {
      llmLogger.info(chalk.red("═".repeat(80)), "debug");
      llmLogger.info(chalk.white(summary.content), "debug");
      llmLogger.info(chalk.red("═".repeat(80)), "debug");
    }

    if (summary.hasToolCalls) {
      llmLogger.info(
        chalk.magenta(`\n🔧 Tool calls detected: ${summary.toolCallCount}`),
        "verbose"
      );
    }
  }

  private logResponseTelemetry(summary: ResponseSummary): void {
    if (!summary.usage) return;

    const totalTokens = (summary.usage.prompt_tokens || 0) + (summary.usage.completion_tokens || 0);

    llmLogger.info(chalk.yellow.bold("\n📊 Response Telemetry:"), "verbose");
    if (summary.model) {
      llmLogger.info(chalk.yellow(`   Model: ${summary.model}`), "verbose");
    }
    llmLogger.info(
      chalk.yellow(`   Prompt tokens: ${summary.usage.prompt_tokens || 0}`),
      "verbose"
    );
    llmLogger.info(
      chalk.yellow(`   Completion tokens: ${summary.usage.completion_tokens || 0}`),
      "verbose"
    );
    llmLogger.info(chalk.yellow(`   Total tokens: ${totalTokens}`), "verbose");

    // Log cache-specific metrics if available
    if (summary.usage.cache_creation_input_tokens) {
      llmLogger.info(
        chalk.green(`   Cache creation tokens: ${summary.usage.cache_creation_input_tokens}`),
        "verbose"
      );
    }
    if (summary.usage.cache_read_input_tokens) {
      llmLogger.info(
        chalk.green(`   Cache read tokens: ${summary.usage.cache_read_input_tokens}`),
        "verbose"
      );
    }

    llmLogger.info(chalk.magenta("─".repeat(80)), "verbose");
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

  private extractResponseContent(response: unknown): string | undefined {
    if (typeof response !== "object" || response === null) {
      return undefined;
    }

    const resp = response as Record<string, unknown>;

    // Handle Anthropic format
    if (resp.content) {
      if (Array.isArray(resp.content)) {
        return resp.content
          .filter((c: unknown) => (c as Record<string, unknown>).type === "text")
          .map((c: unknown) => (c as Record<string, unknown>).text as string)
          .join("\n");
      }
      if (typeof resp.content === "string") {
        return resp.content;
      }
    }

    // Handle OpenAI format
    const choices = resp.choices as unknown[];
    if (Array.isArray(choices) && choices.length > 0) {
      const firstChoice = choices[0] as Record<string, unknown>;
      const message = firstChoice.message as Record<string, unknown>;
      if (typeof message?.content === "string") {
        return message.content;
      }
    }

    return undefined;
  }

  private extractUsage(response: unknown): ResponseSummary["usage"] | undefined {
    if (typeof response !== "object" || response === null) {
      return undefined;
    }

    const resp = response as Record<string, unknown>;
    const usage = resp.usage as Record<string, unknown>;

    if (usage) {
      return {
        prompt_tokens: (usage.prompt_tokens as number) || (usage.input_tokens as number),
        completion_tokens: (usage.completion_tokens as number) || (usage.output_tokens as number),
        total_tokens: usage.total_tokens as number,
        cache_creation_input_tokens: usage.cache_creation_input_tokens as number,
        cache_read_input_tokens: usage.cache_read_input_tokens as number,
      };
    }
    return undefined;
  }

  private hasToolCalls(response: unknown): boolean {
    if (typeof response !== "object" || response === null) {
      return false;
    }

    const resp = response as Record<string, unknown>;

    // Anthropic format
    if (Array.isArray(resp.content)) {
      return resp.content.some((c: unknown) => (c as Record<string, unknown>).type === "tool_use");
    }

    // OpenAI format
    const choices = resp.choices as unknown[];
    if (Array.isArray(choices) && choices.length > 0) {
      const firstChoice = choices[0] as Record<string, unknown>;
      const message = firstChoice.message as Record<string, unknown>;
      const toolCalls = message?.tool_calls as unknown[];
      return Array.isArray(toolCalls) && toolCalls.length > 0;
    }

    return false;
  }

  private countToolCalls(response: unknown): number {
    if (typeof response !== "object" || response === null) {
      return 0;
    }

    const resp = response as Record<string, unknown>;

    // Anthropic format
    if (Array.isArray(resp.content)) {
      return resp.content.filter((c: unknown) => (c as Record<string, unknown>).type === "tool_use")
        .length;
    }

    // OpenAI format
    const choices = resp.choices as unknown[];
    if (Array.isArray(choices) && choices.length > 0) {
      const firstChoice = choices[0] as Record<string, unknown>;
      const message = firstChoice.message as Record<string, unknown>;
      const toolCalls = message?.tool_calls as unknown[];
      return Array.isArray(toolCalls) ? toolCalls.length : 0;
    }

    return 0;
  }

  logError(errorMessage: string, errorDetails?: unknown): void {
    logger.error(`${this.providerName} provider error: ${errorMessage}`, errorDetails);
  }
}
