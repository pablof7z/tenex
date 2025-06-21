import type { LLMPreset, LLMSettings, ProviderAuth } from "@tenex/types/config";
import type { Message } from "multi-llm-ts";

// Re-export the shared types
export type LLMConfig = LLMPreset;
export type ProviderCredentials = ProviderAuth;
export type LLMConfiguration = LLMSettings;

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
  systemPromptHash?: string;
  userPromptHash?: string;
}
