/**
 * Consolidated LLM configuration types with discriminated unions
 */

import type { TokenUsage } from "./usage";
import { createTokenUsage } from "./usage";

// Re-export the base provider type
export type LLMProvider =
    | "anthropic"
    | "openai"
    | "openrouter"
    | "google"
    | "groq"
    | "deepseek"
    | "ollama";

/**
 * Base LLM configuration with common fields
 */
export interface BaseLLMConfig {
    readonly _brand: "LLMConfig";
    provider: LLMProvider;
    model: string;
    apiKey?: string;
    baseURL?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stopSequences?: string[];
    enableCaching?: boolean;
    contextWindowSize?: number;
    timeout?: number;
}

/**
 * Provider-specific configurations with discriminated unions
 */
export interface AnthropicConfig extends BaseLLMConfig {
    provider: "anthropic";
    anthropicVersion?: string;
    anthropicBeta?: string[];
}

export interface OpenAIConfig extends BaseLLMConfig {
    provider: "openai";
    responseFormat?: { type: "text" | "json_object" };
}

export interface OpenRouterConfig extends BaseLLMConfig {
    provider: "openrouter";
    openrouterBeta?: boolean;
}

export interface GoogleConfig extends BaseLLMConfig {
    provider: "google";
}

export interface GroqConfig extends BaseLLMConfig {
    provider: "groq";
}

export interface DeepSeekConfig extends BaseLLMConfig {
    provider: "deepseek";
}

export interface OllamaConfig extends BaseLLMConfig {
    provider: "ollama";
}

/**
 * Discriminated union of all LLM configurations
 */
export type LLMConfig =
    | AnthropicConfig
    | OpenAIConfig
    | OpenRouterConfig
    | GoogleConfig
    | GroqConfig
    | DeepSeekConfig
    | OllamaConfig;

/**
 * Type guards for LLM configurations
 */
export const isAnthropicConfig = (config: LLMConfig): config is AnthropicConfig =>
    config.provider === "anthropic";

export const isOpenAIConfig = (config: LLMConfig): config is OpenAIConfig =>
    config.provider === "openai";

export const isOpenRouterConfig = (config: LLMConfig): config is OpenRouterConfig =>
    config.provider === "openrouter";

export const isGoogleConfig = (config: LLMConfig): config is GoogleConfig =>
    config.provider === "google";

export const isGroqConfig = (config: LLMConfig): config is GroqConfig => config.provider === "groq";

export const isDeepSeekConfig = (config: LLMConfig): config is DeepSeekConfig =>
    config.provider === "deepseek";

export const isOllamaConfig = (config: LLMConfig): config is OllamaConfig =>
    config.provider === "ollama";

/**
 * LLM metadata for responses
 */
export interface LLMMetadata {
    readonly _brand: "LLMMetadata";
    model?: string;
    provider?: string;
    usage?: TokenUsage;
    confidence?: number;
    systemPrompt?: string;
    userPrompt?: string;
    rawResponse?: string;
    isToolResult?: boolean;
    temperature?: number;
    maxTokens?: number;
    toolCallsCount?: number;
}

/**
 * Factory function to create LLMMetadata
 */
export function createLLMMetadata(input: {
    model?: string;
    provider?: string;
    usage?:
        | TokenUsage
        | {
              promptTokens?: number;
              prompt_tokens?: number;
              completionTokens?: number;
              completion_tokens?: number;
              totalTokens?: number;
              total_tokens?: number;
              [key: string]: unknown;
          };
    confidence?: number;
    systemPrompt?: string;
    userPrompt?: string;
    rawResponse?: string;
    isToolResult?: boolean;
    temperature?: number;
    maxTokens?: number;
    toolCallsCount?: number;
    toolCalls?: number; // Legacy field name
}): LLMMetadata {
    return {
        _brand: "LLMMetadata",
        model: input.model,
        provider: input.provider,
        usage:
            typeof input.usage === "object" && input.usage && "_brand" in input.usage
                ? (input.usage as TokenUsage)
                : input.usage
                  ? createTokenUsage(input.usage)
                  : undefined,
        confidence: input.confidence,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        rawResponse: input.rawResponse,
        isToolResult: input.isToolResult,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        toolCallsCount: input.toolCallsCount ?? input.toolCalls,
    } as LLMMetadata;
}

/**
 * Legacy LLM configuration interface
 */
interface LegacyLLMConfigInput {
    provider: LLMProvider;
    model?: string;
    apiKey?: string;
    baseURL?: string;
    baseUrl?: string; // Legacy field name
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stopSequences?: string[];
    enableCaching?: boolean;
    contextWindowSize?: number;
    timeout?: number;
    // Provider-specific fields
    anthropicVersion?: string;
    anthropicBeta?: string[];
    responseFormat?: { type: "text" | "json_object" };
    openrouterBeta?: boolean;
}

/**
 * Type guard for legacy LLM configuration
 */
function isLegacyLLMConfigInput(obj: unknown): obj is LegacyLLMConfigInput {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }

    const candidate = obj as Record<string, unknown>;

    return "provider" in candidate && typeof candidate.provider === "string";
}

/**
 * Migration utility for legacy LLM configurations
 */
export function migrateLegacyLLMConfig(legacy: unknown): LLMConfig {
    if (!isLegacyLLMConfigInput(legacy)) {
        throw new Error("Invalid legacy LLM config format");
    }

    const base: BaseLLMConfig = {
        _brand: "LLMConfig",
        provider: legacy.provider,
        model: legacy.model || "",
        apiKey: legacy.apiKey,
        baseURL: legacy.baseURL || legacy.baseUrl,
        temperature: legacy.temperature,
        maxTokens: legacy.maxTokens,
        topP: legacy.topP,
        topK: legacy.topK,
        frequencyPenalty: legacy.frequencyPenalty,
        presencePenalty: legacy.presencePenalty,
        stopSequences: legacy.stopSequences,
        enableCaching: legacy.enableCaching,
        contextWindowSize: legacy.contextWindowSize,
        timeout: legacy.timeout,
    };

    switch (legacy.provider) {
        case "anthropic":
            return {
                ...base,
                provider: "anthropic",
                anthropicVersion: legacy.anthropicVersion,
                anthropicBeta: legacy.anthropicBeta,
            } as AnthropicConfig;

        case "openai":
            return {
                ...base,
                provider: "openai",
                responseFormat: legacy.responseFormat,
            } as OpenAIConfig;

        case "openrouter":
            return {
                ...base,
                provider: "openrouter",
                openrouterBeta: legacy.openrouterBeta,
            } as OpenRouterConfig;

        case "google":
            return { ...base, provider: "google" } as GoogleConfig;

        case "groq":
            return { ...base, provider: "groq" } as GroqConfig;

        case "deepseek":
            return { ...base, provider: "deepseek" } as DeepSeekConfig;

        case "ollama":
            return { ...base, provider: "ollama" } as OllamaConfig;

        default:
            throw new Error(`Unsupported legacy provider: ${legacy.provider}`);
    }
}
