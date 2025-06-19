export type LLMProvider =
    | "openai"
    | "openrouter"
    | "anthropic"
    | "google"
    | "groq"
    | "deepseek"
    | "ollama";

export type SpeechProvider = "openai" | "openrouter";

export interface LLMCredentials {
    apiKey?: string;
    baseUrl?: string;
    headers?: Record<string, string>;
}

export interface LLMConfig {
    provider: LLMProvider;
    model: string;
    enableCaching?: boolean;
    contextWindowSize?: number;
    temperature?: number;
    maxTokens?: number;
}

export interface SpeechConfig {
    provider: SpeechProvider;
    model: string;
    language?: string;
}

export interface UnifiedLLMConfig {
    configurations: {
        [name: string]: LLMConfig;
    };
    defaults: {
        default?: string;
        titleGeneration?: string;
        [agentName: string]: string | undefined;
    };
    credentials: {
        [provider: string]: LLMCredentials;
    };
    speech?: {
        configuration: SpeechConfig;
        credentials: LLMCredentials;
    };
}

export interface OpenRouterModel {
    id: string;
    name: string;
    description?: string;
    pricing: {
        prompt: string;
        completion: string;
        request?: string;
        image?: string;
        web_search?: string;
        internal_reasoning?: string;
        input_cache_read?: string;
        input_cache_write?: string;
    };
    context_length: number;
    architecture: {
        modality: string;
        tokenizer: string;
        instruct_type?: string;
    };
    top_provider: {
        context_length: number;
        max_completion_tokens?: number;
    };
    input_modalities?: string[];
    output_modalities?: string[];
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

export interface OpenRouterModelsResponse {
    data: OpenRouterModel[];
}

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

export interface LLMTitleGenerationError extends Error {
    code: "NO_API_KEY" | "API_ERROR" | "INVALID_RESPONSE";
}

// Default models for each provider
export const DEFAULT_MODELS: Record<LLMProvider, string> = {
    openai: "gpt-3.5-turbo",
    openrouter: "anthropic/claude-3-haiku",
    anthropic: "claude-3-5-sonnet-20241022",
    google: "gemini-1.5-pro",
    groq: "llama-3.1-70b-versatile",
    deepseek: "deepseek-chat",
    ollama: "llama3.2",
};

// Static model lists for providers that don't have dynamic APIs
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

// Speech-to-text models
export const SPEECH_MODELS: Record<SpeechProvider, Array<{ id: string; name: string }>> = {
    openai: [{ id: "whisper-1", name: "Whisper" }],
    openrouter: [{ id: "openai/whisper-1", name: "Whisper (via OpenRouter)" }],
};
