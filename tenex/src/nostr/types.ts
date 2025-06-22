import type { NDKEvent } from "@nostr-dev-kit/ndk";

export interface LLMMetadata {
  model: string;
  cost: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  systemPromptHash?: string;
  userPromptHash?: string;
}

export interface PublishOptions {
  llmMetadata?: LLMMetadata;
  metadata?: Record<string, string | number | boolean | string[]>;
}