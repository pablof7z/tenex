import type { Message } from "multi-llm-ts";

export type LLMProvider =
    | "openai"
    | "openrouter"
    | "anthropic"
    | "google"
    | "groq"
    | "deepseek"
    | "ollama";

export interface LLMPreset {
    provider: LLMProvider;
    model: string;
    enableCaching?: boolean;
    temperature?: number;
    maxTokens?: number;
}

export interface ProviderAuth {
    apiKey?: string;
    baseUrl?: string;
    headers?: Record<string, string>;
}

// LLMSettings moved to TenexLLMs in @/types/config

export interface LLMConfig {
  provider: string;
  model: string;
  enableCaching?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderCredentials {
  apiKey: string;
  baseUrl?: string;
}

export interface ProviderAuth {
  apiKey?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}

export interface LLMResponse {
  content: string;
  usage?: {
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

export interface LLMPromptContext {
  messages: Message[];
  configName: string;
  stream?: boolean;
}

// Configuration types moved to @/types/config

/**
 * Event kinds used in the TENEX system
 */
export const EVENT_KINDS = {
  GENERIC_REPLY: 1,
  PROJECT: 24000,
  AGENT_CONFIG: 24001,
  TASK: 24002,
  PROJECT_STATUS: 24010,
  CONVERSATION: 24011,
  TYPING_INDICATOR: 24111,
  TYPING_INDICATOR_STOP: 24112,
} as const;

/**
 * Project data structure
 */
export interface ProjectData {
  identifier: string;
  pubkey: string;
  naddr: string;
  title: string;
  description?: string;
  repoUrl?: string;
  hashtags: string[];
  agentEventIds: string[];
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Import Agent type to maintain compatibility
 */
export type { Agent } from "./agent";

/**
 * Token usage tracking
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * LLM configurations collection
 */
export type LLMConfigs = Record<string, LLMConfig>;
