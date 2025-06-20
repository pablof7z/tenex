import type { Message } from "multi-llm-ts";

export interface LLMConfig {
  provider: string;
  model: string;
  enableCaching?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMConfiguration {
  configurations: Record<string, LLMConfig>;
  defaults: Record<string, string>;
  credentials: Record<string, ProviderCredentials>;
}

export interface ProviderCredentials {
  apiKey: string;
  baseUrl?: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
}

export interface LLMStreamChunk {
  type: "content" | "error" | "done";
  text?: string;
  error?: string;
}

export interface LLMMetadata {
  model: string;
  cost: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  systemPrompt: string;
  userPrompt: string;
}
