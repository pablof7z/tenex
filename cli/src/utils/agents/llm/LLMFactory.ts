import { logger } from "../../logger";
import type { LLMConfig } from "../types";
import { AnthropicProvider } from "./AnthropicProvider";
import { AnthropicProviderWithCache } from "./AnthropicProviderWithCache";
import { OpenAIProvider } from "./OpenAIProvider";
import { OpenRouterProvider } from "./OpenRouterProvider";
import type { LLMProvider } from "./types";

export class LLMFactory {
	private static providers: Map<string, LLMProvider> = new Map();

	static createProvider(config: LLMConfig): LLMProvider {
		// Include caching preference in cache key to distinguish providers
		const cacheKey = `${config.provider}-${config.model}-${config.baseURL || "default"}-${config.enableCaching !== false}`;

		// Return cached provider if exists
		const cached = this.providers.get(cacheKey);
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
				// Ollama uses OpenAI-compatible API with custom base URL
				provider = new OpenAIProvider();
				break;

			default:
				// Try OpenAI provider as default for unknown providers
				logger.warn(
					`Unknown provider '${config.provider}', attempting OpenAI-compatible API`,
				);
				provider = new OpenAIProvider();
		}

		// Cache the provider
		this.providers.set(cacheKey, provider);

		return provider;
	}

	static clearCache(): void {
		this.providers.clear();
	}
}
