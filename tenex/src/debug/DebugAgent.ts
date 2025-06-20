import type { Message } from "multi-llm-ts";
import { v4 as uuidv4 } from "uuid";
import type { LLMService } from "../llm/LLMService";
import type { LLMResponse } from "../llm/types";
import type { PromptBuilder } from "../prompts/core/PromptBuilder";
import type { AgentProfile } from "../types";
import { createMessage } from "./utils";
import { logDebug, logError } from "@tenex/shared/logger";

type LLMMessage = Message;
type ToolCallResult = {
  toolCallId: string;
  result: any;
};
import { logDebug, logError } from "@tenex/shared/logger";

export interface DebugAgentConfig {
  name: string;
  model?: string;
  provider?: string;
  profile?: AgentProfile;
  tools?: Map<string, (args: any) => Promise<any>>;
}

export class DebugAgent {
  private id: string;
  private name: string;
  private conversationHistory: LLMMessage[] = [];
  private tools: Map<string, (args: any) => Promise<any>>;
  private llmService: LLMService;
  private promptBuilder: PromptBuilder;
  private profile: AgentProfile;

  constructor(config: DebugAgentConfig, llmService: LLMService, promptBuilder: PromptBuilder) {
    this.id = uuidv4();
    this.name = config.name;
    this.tools = config.tools || new Map();
    this.llmService = llmService;
    this.promptBuilder = promptBuilder;
    this.profile = config.profile || {
      name: config.name,
      role: "debug-agent",
      description: `Debug agent for testing ${config.name}`,
      capabilities: [],
    };
  }

  async sendMessage(content: string): Promise<LLMResponse & { message?: string }> {
    try {
      // Add user message to history
      const userMessage = createMessage("user", content);
      this.conversationHistory.push(userMessage);

      // Build system prompt
      const systemPrompt = await this.buildSystemPrompt();

      // Create messages array with system prompt and conversation history
      const messages: LLMMessage[] = [
        createMessage("system", systemPrompt),
        ...this.conversationHistory,
      ];

      // Send to LLM using default configuration
      const response = await this.llmService.complete("default", messages);

      // Handle tool calls if present
      // Note: multi-llm-ts doesn't support tool calls yet, so we'll skip this for now
      if (false) {
        const toolResults = await this.executeTools(response.toolCalls);

        // Add assistant response with tool calls to history
        this.conversationHistory.push(
          createMessage("assistant", response.content || "", { toolCalls: response.toolCalls })
        );

        // Add tool results to history
        for (const result of toolResults) {
          this.conversationHistory.push(
            createMessage(
              "tool",
              typeof result.result === "string"
                ? result.result
                : JSON.stringify(result.result, null, 2),
              { toolCallId: result.toolCallId }
            )
          );
        }

        // Get final response after tool execution
        const finalMessages: LLMMessage[] = [
          createMessage("system", systemPrompt),
          ...this.conversationHistory,
        ];

        const finalResponse = await this.llmService.complete("default", finalMessages);

        // Add final response to history
        this.conversationHistory.push(
          createMessage("assistant", finalResponse.content || "")
        );

        return {
          ...finalResponse,
          message: finalResponse.content,
        };
      }

      // Add assistant response to history
      this.conversationHistory.push(
        createMessage("assistant", response.content || "")
      );

      return {
        ...response,
        message: response.content,
      };
    } catch (error) {
      logError("Error in DebugAgent.sendMessage:", error);
      throw error;
    }
  }

  private async buildSystemPrompt(): Promise<string> {
    // Use prompt builder to create agent prompt
    const prompt = this.promptBuilder
      .add("agentCore")
      .add("agentProfile", { profile: this.profile })
      .add("debugInstructions")
      .build();

    // Add tool descriptions if tools are available
    if (this.tools.size > 0) {
      const toolDescriptions = Array.from(this.tools.entries())
        .map(([name, _]) => `- ${name}: Available for execution`)
        .join("\n");

      return `${prompt}\n\nAvailable Tools:\n${toolDescriptions}`;
    }

    return prompt;
  }

  private async executeTools(toolCalls: any[]): Promise<ToolCallResult[]> {
    const results: ToolCallResult[] = [];

    for (const toolCall of toolCalls) {
      try {
        const toolName = toolCall.function?.name || toolCall.name;
        const toolArgs = toolCall.function?.arguments || toolCall.arguments || {};

        logDebug("debug", `Executing tool: ${toolName}`, { args: toolArgs });

        const tool = this.tools.get(toolName);
        if (!tool) {
          results.push({
            toolCallId: toolCall.id,
            result: { error: `Tool ${toolName} not found` },
          });
          continue;
        }

        const result = await tool(toolArgs);
        results.push({
          toolCallId: toolCall.id,
          result,
        });
      } catch (error) {
        logError(`Error executing tool ${toolCall.function?.name || toolCall.name}:`, error);
        results.push({
          toolCallId: toolCall.id,
          result: { error: error.message || "Tool execution failed" },
        });
      }
    }

    return results;
  }

  getSystemPrompt(): string {
    return this.promptBuilder
      .add("agentCore")
      .add("agentProfile", { profile: this.profile })
      .add("debugInstructions")
      .build();
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getHistory(): LLMMessage[] {
    return [...this.conversationHistory];
  }

  getName(): string {
    return this.name;
  }

  getId(): string {
    return this.id;
  }
}
