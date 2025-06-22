/**
 * Clean LLM types with single responsibility
 * No agent or orchestration concerns
 */

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

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
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
  provider: "anthropic" | "openai" | "google" | "ollama" | "mistral" | "groq" | "openrouter";
  model: string;
  apiKey?: string;
  baseUrl?: string;
  defaultOptions?: Partial<CompletionOptions>;
}
