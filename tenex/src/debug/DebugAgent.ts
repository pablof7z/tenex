import { logDebug, logError } from "@tenex/shared/logger";
import type { Message } from "multi-llm-ts";
import { v4 as uuidv4 } from "uuid";
import type { LLMService } from "../llm/LLMService";
import type { LLMResponse } from "../llm/types";
import type { PromptBuilder } from "../prompts/core/PromptBuilder";
import type { AgentProfile } from "../types";
import { createMessage } from "./utils";

type LLMMessage = Message;

export interface DebugAgentConfig {
  name: string;
  model?: string;
  provider?: string;
  profile?: AgentProfile;
  tools?: Map<string, (args: unknown) => Promise<unknown>>;
}

export class DebugAgent {
  private id: string;
  private name: string;
  private conversationHistory: LLMMessage[] = [];
  private tools: Map<string, (args: unknown) => Promise<unknown>>;
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


      // Add assistant response to history
      this.conversationHistory.push(createMessage("assistant", response.content || ""));

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
