import type { LLMConfigManager } from "@/llm/ConfigManager";
import type { LLMService as ILLMService } from "@/llm/LLMService";
import type { LLMConfig, LLMResponse } from "@/llm/types";
import type { Message } from "multi-llm-ts";

type LLMMessage = Message;

export class MockLLMResponse implements LLMResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;

  constructor(content: string, options: Partial<LLMResponse> = {}) {
    this.content = content;
    this.model = options.model || "mock-model";
    this.usage = options.usage || {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    };
    this.cost = options.cost;
  }
}

export class MockLLMService implements Partial<ILLMService> {
  private responses: Map<string, LLMResponse> = new Map();
  private defaultResponse: LLMResponse;
  public callHistory: Array<{ messages: LLMMessage[]; config?: string }> = [];

  constructor(defaultResponse?: string) {
    this.defaultResponse = new MockLLMResponse(defaultResponse || "This is a mock response");
  }

  async chat(messages: LLMMessage[], configName?: string): Promise<LLMResponse> {
    this.callHistory.push({ messages, config: configName });

    // Check if we have a specific response for this message pattern
    const lastMessage = messages[messages.length - 1];
    const responseKey = `${lastMessage.role}:${lastMessage.content}`;

    return this.responses.get(responseKey) || this.defaultResponse;
  }

  setResponse(pattern: string, response: LLMResponse): void {
    this.responses.set(pattern, response);
  }

  setDefaultResponse(response: LLMResponse): void {
    this.defaultResponse = response;
  }

  clearHistory(): void {
    this.callHistory = [];
  }

  getLastCall(): { messages: LLMMessage[]; config?: string } | undefined {
    return this.callHistory[this.callHistory.length - 1];
  }
}

export class MockLLMConfigManager implements Partial<LLMConfigManager> {
  private configs: Map<string, LLMConfig> = new Map();

  constructor() {
    // Add default config
    this.configs.set("default", {
      provider: "mock",
      model: "mock-model",
      temperature: 0.7,
    });
  }

  async loadConfigurations(): Promise<void> {
    // Mock load
    return Promise.resolve();
  }

  async getConfig(name: string): Promise<LLMConfig | undefined> {
    return this.configs.get(name);
  }

  getDefaultConfig(): LLMConfig | undefined {
    return this.configs.get("default");
  }

  addConfig(name: string, config: LLMConfig): void {
    this.configs.set(name, config);
  }
}

export function createMockLLMService(defaultResponse?: string): MockLLMService {
  return new MockLLMService(defaultResponse);
}

export function createMockLLMConfigManager(): MockLLMConfigManager {
  return new MockLLMConfigManager();
}
