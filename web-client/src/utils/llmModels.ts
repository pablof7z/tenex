import type {
    LLMModelOption,
    LLMProvider,
    OpenRouterModelsResponse,
    OpenRouterModelWithMetadata,
} from "../types/llm";
import { isOllamaModelsResponse } from "@tenex/types/core";
import { STATIC_MODELS as MODELS } from "../types/llm";

/**
 * Fetch available models from OpenRouter API
 */
export async function fetchOpenRouterModels(): Promise<OpenRouterModelWithMetadata[]> {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/models", {
            headers: {
                "HTTP-Referer": window.location.origin,
                "X-Title": "TENEX Web Client",
            },
        });

        if (!response.ok) {
            throw new Error(`OpenRouter API returned ${response.status}`);
        }

        const data = (await response.json()) as OpenRouterModelsResponse;
        return data.data
            .filter((model) => {
                // Only include text-input/text-output models
                const hasTextInput = model.input_modalities?.includes("text") ?? true;
                const hasTextOutput = model.output_modalities?.includes("text") ?? true;
                return hasTextInput && hasTextOutput;
            })
            .map((model) => ({
                id: model.id,
                name: model.name,
                supportsCaching: !!(
                    model.pricing.input_cache_read && model.pricing.input_cache_write
                ),
                promptPrice: Number.parseFloat(model.pricing.prompt) * 1000000, // Convert to price per 1M tokens
                completionPrice: Number.parseFloat(model.pricing.completion) * 1000000,
                cacheReadPrice: model.pricing.input_cache_read
                    ? Number.parseFloat(model.pricing.input_cache_read) * 1000000
                    : undefined,
                cacheWritePrice: model.pricing.input_cache_write
                    ? Number.parseFloat(model.pricing.input_cache_write) * 1000000
                    : undefined,
                contextLength: model.context_length,
            }))
            .sort((a, b) => a.id.localeCompare(b.id));
    } catch (error) {
        console.warn(`Could not fetch OpenRouter models: ${error}`);
        // Return common OpenRouter models as fallback
        return [
            {
                id: "anthropic/claude-3.5-sonnet",
                name: "Claude 3.5 Sonnet",
                supportsCaching: true,
                promptPrice: 3,
                completionPrice: 15,
                contextLength: 200000,
            },
            {
                id: "openai/gpt-4o",
                name: "GPT-4o",
                supportsCaching: false,
                promptPrice: 5,
                completionPrice: 15,
                contextLength: 128000,
            },
            {
                id: "anthropic/claude-3-haiku",
                name: "Claude 3 Haiku",
                supportsCaching: true,
                promptPrice: 0.25,
                completionPrice: 1.25,
                contextLength: 200000,
            },
            {
                id: "google/gemini-pro",
                name: "Gemini Pro",
                supportsCaching: false,
                promptPrice: 0.5,
                completionPrice: 1.5,
                contextLength: 32768,
            },
        ];
    }
}

/**
 * Fetch available models from Ollama (if running locally)
 */
export async function fetchOllamaModels(): Promise<LLMModelOption[]> {
    try {
        const response = await fetch("http://localhost:11434/api/tags");
        if (!response.ok) {
            throw new Error(`Ollama API returned ${response.status}`);
        }

        const data = await response.json();

        // Type guard for Ollama response
        if (!isOllamaModelsResponse(data)) {
            throw new Error("Invalid Ollama models response format");
        }

        return data.models.map((model) => ({
            id: model.name,
            name: model.name,
            provider: "ollama" as LLMProvider,
        }));
    } catch (error) {
        console.warn(`Could not fetch Ollama models: ${error}`);
        console.info("Make sure Ollama is running with: ollama serve");

        // Return fallback models if Ollama is not available
        return [
            { id: "llama3.2", name: "Llama 3.2", provider: "ollama" },
            { id: "llama3.1", name: "Llama 3.1", provider: "ollama" },
            { id: "codellama", name: "CodeLlama", provider: "ollama" },
            { id: "mistral", name: "Mistral", provider: "ollama" },
            { id: "gemma2", name: "Gemma 2", provider: "ollama" },
            { id: "qwen2.5", name: "Qwen 2.5", provider: "ollama" },
        ];
    }
}

/**
 * Get available models for a specific provider
 */
export async function getModelsForProvider(provider: LLMProvider): Promise<LLMModelOption[]> {
    switch (provider) {
        case "openrouter": {
            const models = await fetchOpenRouterModels();
            return models.map((model) => ({
                id: model.id,
                name: model.name,
                provider: "openrouter",
                supportsCaching: model.supportsCaching,
                pricing: {
                    prompt: model.promptPrice,
                    completion: model.completionPrice,
                    cacheRead: model.cacheReadPrice,
                    cacheWrite: model.cacheWritePrice,
                },
                contextLength: model.contextLength,
            }));
        }
        case "ollama":
            return await fetchOllamaModels();
        default:
            return MODELS[provider] || [];
    }
}

/**
 * Get all available models across all providers
 */
export async function getAllModels(): Promise<LLMModelOption[]> {
    const providers: LLMProvider[] = [
        "openai",
        "anthropic",
        "google",
        "groq",
        "deepseek",
        "openrouter",
        "ollama",
    ];

    const modelPromises = providers.map(async (provider) => {
        try {
            return await getModelsForProvider(provider);
        } catch (error) {
            console.warn(`Failed to fetch models for ${provider}:`, error);
            return MODELS[provider] || [];
        }
    });

    const modelArrays = await Promise.all(modelPromises);
    return modelArrays.flat();
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
    return `$${price.toFixed(2)}/1M`;
}

/**
 * Format model name with pricing for display
 */
export function formatModelWithPricing(model: LLMModelOption): string {
    let display = model.name;

    if (model.pricing) {
        const promptPrice = formatPrice(model.pricing.prompt);
        const completionPrice = formatPrice(model.pricing.completion);
        display += ` (${promptPrice}/${completionPrice})`;

        if (model.supportsCaching) {
            display += " 🔄";
        }
    }

    return display;
}

/**
 * Test LLM configuration by making a test API call
 */
export async function testLLMConfiguration(
    provider: LLMProvider,
    apiKey: string,
    model: string
): Promise<boolean> {
    try {
        const baseURL = getProviderBaseURL(provider);

        const headers: Record<string, string> = {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        };

        // Add provider-specific headers
        if (provider === "openrouter") {
            headers["HTTP-Referer"] = window.location.origin;
            headers["X-Title"] = "TENEX Web Client";
        }

        const response = await fetch(`${baseURL}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: "user",
                        content: "Test message - respond with 'OK'",
                    },
                ],
                max_tokens: 5,
                temperature: 0,
            }),
        });

        return response.ok;
    } catch (error) {
        console.error(`Failed to test ${provider} configuration:`, error);
        return false;
    }
}

/**
 * Get base URL for a provider
 */
function getProviderBaseURL(provider: LLMProvider): string {
    switch (provider) {
        case "openai":
            return "https://api.openai.com/v1";
        case "openrouter":
            return "https://openrouter.ai/api/v1";
        case "anthropic":
            return "https://api.anthropic.com/v1";
        case "google":
            return "https://generativelanguage.googleapis.com/v1beta";
        case "groq":
            return "https://api.groq.com/openai/v1";
        case "deepseek":
            return "https://api.deepseek.com/v1";
        case "ollama":
            return "http://localhost:11434/v1";
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
}

/**
 * Validate API key format for a provider
 */
export function validateApiKeyFormat(provider: LLMProvider, apiKey: string): boolean {
    switch (provider) {
        case "openai":
            return apiKey.startsWith("sk-");
        case "openrouter":
            return apiKey.startsWith("sk-or-");
        case "anthropic":
            return apiKey.startsWith("sk-ant-");
        case "google":
            return apiKey.length > 0; // Google API keys don't have a specific format
        case "groq":
            return apiKey.startsWith("gsk_");
        case "deepseek":
            return apiKey.startsWith("sk-");
        case "ollama":
            return true; // Ollama doesn't require API keys
        default:
            return false;
    }
}
