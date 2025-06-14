/**
 * LLM configuration types
 */

export type LLMProvider = "anthropic" | "openai" | "openrouter" | "google" | "groq" | "deepseek";

export interface BaseLLMConfig {
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

export interface AnthropicConfig extends BaseLLMConfig {
    provider: "anthropic";
    model: string;
    anthropicVersion?: string;
    anthropicBeta?: string[];
}

export interface OpenAIConfig extends BaseLLMConfig {
    provider: "openai";
    model: string;
    responseFormat?: { type: "text" | "json_object" };
}

export interface OpenRouterConfig extends BaseLLMConfig {
    provider: "openrouter";
    model: string;
    openrouterBeta?: boolean;
}

export interface GoogleConfig extends BaseLLMConfig {
    provider: "google";
    model: string;
}

export interface GroqConfig extends BaseLLMConfig {
    provider: "groq";
    model: string;
}

export interface DeepSeekConfig extends BaseLLMConfig {
    provider: "deepseek";
    model: string;
}

export type LLMConfig =
    | AnthropicConfig
    | OpenAIConfig
    | OpenRouterConfig
    | GoogleConfig
    | GroqConfig
    | DeepSeekConfig;

/**
 * LLM configuration map for projects
 */
export interface LLMConfigs {
    default: string; // Reference to config name
    [configName: string]: string | LLMConfig; // Config name or full config
}
