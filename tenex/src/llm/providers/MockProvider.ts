import type { Message } from "multi-llm-ts";
import type { LLMConfig, LLMResponse } from "../types";

interface MockProviderOptions {
  defaultResponse?: string;
}

export class MockLLMProvider {
  name = "mock";
  public callHistory: Array<{
    messages: Message[];
    config?: LLMConfig;
    options?: Record<string, unknown>;
  }> = [];

  private defaultResponse: LLMResponse;
  private customResponse?: LLMResponse;
  private throwError?: Error;
  private streamResponse?: string[];
  private delay?: number;
  private customHandler?: (messages: Message[]) => LLMResponse;

  constructor(options: MockProviderOptions = {}) {
    this.defaultResponse = {
      content: options.defaultResponse || "Mock response",
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    };
  }

  async chat(
    messages: Message[],
    config?: LLMConfig,
    options?: Record<string, unknown>
  ): Promise<LLMResponse> {
    this.callHistory.push({ messages, config, options });

    // Simulate delay if set
    if (this.delay) {
      await new Promise((resolve) => setTimeout(resolve, this.delay));
    }

    // Check for timeout
    if (options?.timeout && this.delay && this.delay > options.timeout) {
      throw new Error("Request timeout");
    }

    // Throw error if set
    if (this.throwError) {
      throw this.throwError;
    }

    // Use custom handler if set
    if (this.customHandler) {
      return this.customHandler(messages);
    }

    // Handle streaming if requested
    if (options?.stream && options.onChunk && this.streamResponse) {
      for (const chunk of this.streamResponse) {
        options.onChunk(chunk);
      }
      return {
        content: this.streamResponse.join(""),
      };
    }

    // Return custom or default response
    return this.customResponse || this.defaultResponse;
  }

  // Test helper methods
  setResponse(response: LLMResponse): void {
    this.customResponse = response;
  }

  setThrowError(error: Error): void {
    this.throwError = error;
  }

  setStreamResponse(chunks: string[]): void {
    this.streamResponse = chunks;
  }

  setDelay(ms: number): void {
    this.delay = ms;
  }

  setCustomHandler(handler: (messages: Message[]) => LLMResponse): void {
    this.customHandler = handler;
  }

  clearHistory(): void {
    this.callHistory = [];
  }

  reset(): void {
    this.customResponse = undefined;
    this.throwError = undefined;
    this.streamResponse = undefined;
    this.delay = undefined;
    this.customHandler = undefined;
    this.clearHistory();
  }
}
