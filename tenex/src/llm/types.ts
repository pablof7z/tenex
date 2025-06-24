/**
 * Clean LLM types with single responsibility
 * No agent or orchestration concerns
 */

import { NDKAgent } from "@/events";
import { NDKKind, NDKProject, NDKTask } from "@nostr-dev-kit/ndk";
import type { 
    Message as LlmMessage, 
    LlmCompletionOpts,
    LlmResponse,
    LlmTool,
    LlmToolCall,
} from "multi-llm-ts";

// Re-export multi-llm-ts types directly
export type Message = LlmMessage;
export type CompletionResponse = LlmResponse;
export type ToolDefinition = LlmTool;
export type ToolCall = LlmToolCall;

// Extended completion options with routing context
export interface CompletionOptions extends LlmCompletionOpts {
    configName?: string;
    agentName?: string;
}

// Simplified completion request that uses multi-llm-ts types
export interface CompletionRequest {
    messages: Message[];
    options?: CompletionOptions;
}

/**
 * Pure LLM service interface - single responsibility
 */
export interface LLMService {
    complete(request: CompletionRequest): Promise<CompletionResponse>;
}

/**
 * LLM configuration - decoupled from implementation
 */
export interface LLMConfig {
    provider:
        | "anthropic"
        | "openai"
        | "google"
        | "ollama"
        | "mistral"
        | "groq"
        | "openrouter"
        | "deepseek";
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
 * Event kinds used in the TENEX system
 */
export const EVENT_KINDS = {
    METADATA: 0,
    NEW_CONVERSATION: 11,
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
