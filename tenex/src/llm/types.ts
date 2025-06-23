/**
 * Clean LLM types with single responsibility
 * No agent or orchestration concerns
 */

import { NDKAgent } from "@/events";
import { NDKKind, NDKProject, NDKTask } from "@nostr-dev-kit/ndk";

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface CompletionRequest {
  messages: Message[];
  options?: CompletionOptions;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  tools?: ToolDefinition[];
  stream?: boolean;
}

export interface CompletionResponse {
  content: string;
  model?: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
}

export interface StreamChunk {
  content: string;
  isComplete: boolean;
}

/**
 * Pure LLM service interface - single responsibility
 */
export interface LLMService {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  stream?(request: CompletionRequest): AsyncIterable<StreamChunk>;
}

/**
 * LLM configuration - decoupled from implementation
 */
export interface LLMConfig {
  provider: "anthropic" | "openai" | "google" | "ollama" | "mistral" | "groq" | "openrouter" | "deepseek";
  model: string;
  apiKey?: string;
  baseUrl?: string;
  enableCaching?: boolean;
  temperature?: number;
  maxTokens?: number;
  defaultOptions?: Partial<CompletionOptions>;
}

/**
 * LLM Provider types
 */
export type LLMProvider =
  | "openai"
  | "openrouter"
  | "anthropic"
  | "google"
  | "groq"
  | "deepseek"
  | "ollama"
  | "mistral";

/**
 * Token usage tracking
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Event kinds used in the TENEX system
 */
export const EVENT_KINDS = {
  METADATA: 0,
  GENERIC_REPLY: NDKKind.GenericReply,
  PROJECT: NDKProject.kind,
  AGENT_CONFIG: NDKAgent.kind,
  TASK: NDKTask.kind,
  PROJECT_STATUS: 24010,
  AGENT_REQUEST: 4133,
  TYPING_INDICATOR: 24111,
  TYPING_INDICATOR_STOP: 24112,
} as const;

/**
 * LLM configurations collection
 */
export type LLMConfigs = Record<string, LLMConfig>;

/**
 * LLM Preset configuration
 */
export interface LLMPreset {
  provider: LLMProvider;
  model: string;
  enableCaching?: boolean;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Provider authentication
 */
export interface ProviderAuth {
  apiKey?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}

