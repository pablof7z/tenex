import type { LLMService as ILLMService, LLMConfig, CompletionResponse, Message } from "@/core/llm";

type LLMMessage = Message;

export class MockLLMResponse implements CompletionResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;

  constructor(content: string, options: Partial<CompletionResponse> = {}) {
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
  private responses: Map<string, CompletionResponse> = new Map();
  private defaultResponse: CompletionResponse;
  public callHistory: Array<{ messages: LLMMessage[]; config?: string }> = [];

  constructor(defaultResponse?: string) {
    this.defaultResponse = new MockLLMResponse(defaultResponse || "This is a mock response");
  }

  async chat(messages: LLMMessage[], configName?: string): Promise<CompletionResponse> {
    this.callHistory.push({ messages, config: configName });

    // Check if we have a specific response for this message pattern
    const lastMessage = messages[messages.length - 1];
    const responseKey = `${lastMessage.role}:${lastMessage.content}`;

    return this.responses.get(responseKey) || this.defaultResponse;
  }

  setResponse(pattern: string, response: CompletionResponse): void {
    this.responses.set(pattern, response);
  }

  setDefaultResponse(response: CompletionResponse): void {
    this.defaultResponse = response;
  }

  clearHistory(): void {
    this.callHistory = [];
  }

  getLastCall(): { messages: LLMMessage[]; config?: string } | undefined {
    return this.callHistory[this.callHistory.length - 1];
  }
}

export class MockLLMConfigManager {
  private configs: Map<string, LLMConfig> = new Map();

  constructor() {
    // Add default config
    this.configs.set("default", {
      provider: "openai",
      model: "mock-model",
      temperature: 0.7,
    });
  }

  async loadConfigurations(): Promise<void> {
    // Mock load
    return Promise.resolve();
  }

  getConfig(name: string): LLMConfig {
    const config = this.configs.get(name);
    if (!config) {
      throw new Error(`Config ${name} not found`);
    }
    return config;
  }

  getDefaultConfig(purpose = "default"): string {
    return purpose === "default" ? "default" : "default";
  }

  addConfig(name: string, config: LLMConfig): void {
    this.configs.set(name, config);
  }

  getCredentials(provider: string): { apiKey: string } {
    return { apiKey: "mock-key" };
  }

  getAllConfigNames(): string[] {
    return Array.from(this.configs.keys());
  }

  hasConfig(name: string): boolean {
    return this.configs.has(name);
  }

  getAvailableProviders(): string[] {
    return ["openai"];
  }
}

export function createMockLLMService(defaultResponse?: string): MockLLMService {
  return new MockLLMService(defaultResponse);
}

export function createMockLLMConfigManager(): MockLLMConfigManager {
  return new MockLLMConfigManager();
}
