import { logger } from "@tenex/shared/logger";
import type { ToolRegistry } from "../tools/ToolRegistry";
import type { LLMConfig } from "../types";
import { AnthropicProvider } from "./AnthropicProvider";
import { AnthropicProviderWithCache } from "./AnthropicProviderWithCache";
import { OllamaProvider } from "./OllamaProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { OpenRouterProvider } from "./OpenRouterProvider";
import { ToolEnabledProvider } from "./ToolEnabledProvider";
import type { LLMProvider } from "./types";

const providers: Map<string, LLMProvider> = new Map();

export function createLLMProvider(config: LLMConfig, toolRegistry?: ToolRegistry): LLMProvider {
    // Include caching preference and tools in cache key to distinguish providers
    const cacheKey = `${config.provider}-${config.model}-${config.baseURL || "default"}-${config.enableCaching !== false}-${toolRegistry ? "tools" : "notools"}`;

    // Return cached provider if exists
    const cached = providers.get(cacheKey);
    if (cached) {
        return cached;
    }

    let provider: LLMProvider;

    switch (config.provider.toLowerCase()) {
        case "anthropic":
        case "claude":
            // Use cached provider if caching is enabled
            provider =
                config.enableCaching !== false
                    ? new AnthropicProviderWithCache()
                    : new AnthropicProvider();
            break;

        case "openai":
        case "gpt":
            provider = new OpenAIProvider();
            break;

        case "openrouter":
            // Use specialized OpenRouter provider with caching support
            provider = new OpenRouterProvider();
            break;

        case "ollama":
            provider = new OllamaProvider();
            break;

        default:
            // Try OpenAI provider as default for unknown providers
            logger.warn(`Unknown provider '${config.provider}', attempting OpenAI-compatible API`);
            provider = new OpenAIProvider();
    }

    // Wrap with tool support if toolRegistry is provided
    if (toolRegistry) {
        const providerType =
            config.provider.toLowerCase() === "anthropic" ||
            config.provider.toLowerCase() === "claude"
                ? "anthropic"
                : config.provider.toLowerCase() === "openrouter"
                  ? "openrouter"
                  : config.provider.toLowerCase() === "ollama"
                    ? "openai" // Ollama uses OpenAI-compatible tools format
                    : "openai";
        provider = new ToolEnabledProvider(provider, toolRegistry, providerType);
    }

    // Cache the provider
    providers.set(cacheKey, provider);

    return provider;
}

export function clearLLMProviderCache(): void {
    providers.clear();
}
