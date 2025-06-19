/**
 * Model types for different LLM providers
 */

import type { LLMProvider } from "./llm";

// ============================================================================
// Base Model Types
// ============================================================================

export interface BaseModelInfo {
    readonly _brand: "ModelInfo";
    id: string;
    name: string;
    provider: LLMProvider;
    contextLength?: number;
    supportsCaching?: boolean;
    pricing?: {
        prompt: number;
        completion: number;
        cacheRead?: number;
        cacheWrite?: number;
    };
}

// ============================================================================
// Ollama Model Types
// ============================================================================

export interface OllamaModelDetails {
    format: string;
    family: string;
    families?: string[];
    parameter_size: string;
    quantization_level: string;
}

export interface OllamaModel {
    name: string;
    model: string;
    size: number;
    digest: string;
    details?: OllamaModelDetails;
    modified_at?: string;
}

export interface OllamaModelsResponse {
    models: OllamaModel[];
}

// ============================================================================
// OpenRouter Model Types
// ============================================================================

export interface OpenRouterModelPricing {
    prompt: string;
    completion: string;
    request?: string;
    image?: string;
    web_search?: string;
    internal_reasoning?: string;
    input_cache_read?: string;
    input_cache_write?: string;
}

export interface OpenRouterModelArchitecture {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
}

export interface OpenRouterModelTopProvider {
    context_length: number;
    max_completion_tokens?: number;
}

export interface OpenRouterModel {
    id: string;
    name: string;
    description?: string;
    pricing: OpenRouterModelPricing;
    context_length: number;
    architecture: OpenRouterModelArchitecture;
    top_provider: OpenRouterModelTopProvider;
    input_modalities?: string[];
    output_modalities?: string[];
}

export interface OpenRouterModelsResponse {
    data: OpenRouterModel[];
}

export interface OpenRouterModelWithMetadata {
    id: string;
    name: string;
    supportsCaching: boolean;
    promptPrice: number;
    completionPrice: number;
    cacheReadPrice?: number;
    cacheWritePrice?: number;
    contextLength: number;
}

// ============================================================================
// Generic Model Option for UI
// ============================================================================

export interface LLMModelOption {
    id: string;
    name: string;
    provider: LLMProvider;
    supportsCaching?: boolean;
    pricing?: {
        prompt: number;
        completion: number;
        cacheRead?: number;
        cacheWrite?: number;
    };
    contextLength?: number;
}

// ============================================================================
// Type Guards
// ============================================================================

export const isOllamaModel = (model: unknown): model is OllamaModel =>
    typeof model === "object" &&
    model !== null &&
    "name" in model &&
    typeof model.name === "string" &&
    "model" in model &&
    typeof model.model === "string" &&
    "size" in model &&
    typeof model.size === "number" &&
    "digest" in model &&
    typeof model.digest === "string";

export const isOllamaModelsResponse = (response: unknown): response is OllamaModelsResponse =>
    typeof response === "object" &&
    response !== null &&
    "models" in response &&
    Array.isArray(response.models) &&
    response.models.every(isOllamaModel);

export const isOpenRouterModel = (model: unknown): model is OpenRouterModel =>
    typeof model === "object" &&
    model !== null &&
    "id" in model &&
    typeof model.id === "string" &&
    "name" in model &&
    typeof model.name === "string" &&
    "pricing" in model &&
    typeof model.pricing === "object" &&
    "context_length" in model &&
    typeof model.context_length === "number";

export const isOpenRouterModelsResponse = (
    response: unknown
): response is OpenRouterModelsResponse =>
    typeof response === "object" &&
    response !== null &&
    "data" in response &&
    Array.isArray(response.data) &&
    response.data.every(isOpenRouterModel);

// ============================================================================
// Conversion Utilities
// ============================================================================

export function ollamaModelToOption(model: OllamaModel): LLMModelOption {
    return {
        id: model.name,
        name: model.name,
        provider: "ollama",
        contextLength: undefined, // Ollama doesn't provide context length in model list
    };
}

export function openRouterModelToOption(model: OpenRouterModel): LLMModelOption {
    return {
        id: model.id,
        name: model.name,
        provider: "openrouter",
        contextLength: model.context_length,
        supportsCaching: Boolean(model.pricing.input_cache_read),
        pricing: {
            prompt: Number.parseFloat(model.pricing.prompt),
            completion: Number.parseFloat(model.pricing.completion),
            cacheRead: model.pricing.input_cache_read
                ? Number.parseFloat(model.pricing.input_cache_read)
                : undefined,
            cacheWrite: model.pricing.input_cache_write
                ? Number.parseFloat(model.pricing.input_cache_write)
                : undefined,
        },
    };
}

export function openRouterModelToMetadata(model: OpenRouterModel): OpenRouterModelWithMetadata {
    return {
        id: model.id,
        name: model.name,
        supportsCaching: Boolean(model.pricing.input_cache_read),
        promptPrice: Number.parseFloat(model.pricing.prompt),
        completionPrice: Number.parseFloat(model.pricing.completion),
        cacheReadPrice: model.pricing.input_cache_read
            ? Number.parseFloat(model.pricing.input_cache_read)
            : undefined,
        cacheWritePrice: model.pricing.input_cache_write
            ? Number.parseFloat(model.pricing.input_cache_write)
            : undefined,
        contextLength: model.context_length,
    };
}

// ============================================================================
// Default Model Collections
// ============================================================================

export const DEFAULT_MODELS: Record<LLMProvider, string> = {
    openai: "gpt-3.5-turbo",
    openrouter: "anthropic/claude-3-haiku",
    anthropic: "claude-3-5-sonnet-20241022",
    google: "gemini-1.5-pro",
    groq: "llama-3.1-70b-versatile",
    deepseek: "deepseek-chat",
    ollama: "llama3.2",
};

export const STATIC_MODELS: Record<LLMProvider, LLMModelOption[]> = {
    openai: [
        { id: "gpt-4o", name: "GPT-4o", provider: "openai", contextLength: 128000 },
        { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", contextLength: 128000 },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "openai", contextLength: 128000 },
        { id: "gpt-4", name: "GPT-4", provider: "openai", contextLength: 8192 },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "openai", contextLength: 16384 },
    ],
    anthropic: [
        {
            id: "claude-3-5-sonnet-20241022",
            name: "Claude 3.5 Sonnet",
            provider: "anthropic",
            supportsCaching: true,
            contextLength: 200000,
        },
        {
            id: "claude-3-5-haiku-20241022",
            name: "Claude 3.5 Haiku",
            provider: "anthropic",
            supportsCaching: true,
            contextLength: 200000,
        },
        {
            id: "claude-3-opus-20240229",
            name: "Claude 3 Opus",
            provider: "anthropic",
            supportsCaching: true,
            contextLength: 200000,
        },
        {
            id: "claude-3-sonnet-20240229",
            name: "Claude 3 Sonnet",
            provider: "anthropic",
            supportsCaching: true,
            contextLength: 200000,
        },
        {
            id: "claude-3-haiku-20240307",
            name: "Claude 3 Haiku",
            provider: "anthropic",
            supportsCaching: true,
            contextLength: 200000,
        },
    ],
    google: [
        {
            id: "gemini-1.5-pro",
            name: "Gemini 1.5 Pro",
            provider: "google",
            contextLength: 1048576,
        },
        {
            id: "gemini-1.5-flash",
            name: "Gemini 1.5 Flash",
            provider: "google",
            contextLength: 1048576,
        },
        { id: "gemini-pro", name: "Gemini Pro", provider: "google", contextLength: 32768 },
    ],
    groq: [
        {
            id: "llama-3.1-70b-versatile",
            name: "Llama 3.1 70B Versatile",
            provider: "groq",
            contextLength: 32768,
        },
        {
            id: "llama-3.1-8b-instant",
            name: "Llama 3.1 8B Instant",
            provider: "groq",
            contextLength: 32768,
        },
        { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", provider: "groq", contextLength: 32768 },
    ],
    deepseek: [
        { id: "deepseek-chat", name: "DeepSeek Chat", provider: "deepseek", contextLength: 32768 },
        {
            id: "deepseek-coder",
            name: "DeepSeek Coder",
            provider: "deepseek",
            contextLength: 32768,
        },
    ],
    openrouter: [], // Will be populated dynamically
    ollama: [], // Will be populated dynamically
};
