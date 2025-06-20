import type { ToolRegistry } from "@/utils/agents/tools/ToolRegistry";
import type { LLMConfig } from "@/utils/agents/types";
import { logger } from "@tenex/shared/logger";
import {
  ConditionalProviderFactory,
  ProviderRegistry,
  SimpleProviderFactory,
} from "./registry/ProviderRegistry";
import type { LLMProvider } from "./types";

// Import providers for registration
import { AnthropicProvider } from "./AnthropicProvider";
import { OllamaProvider } from "./OllamaProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { OpenRouterProvider } from "./OpenRouterProvider";

// Legacy providers map for backward compatibility
const legacyProviders: Map<string, LLMProvider> = new Map();

// Initialize provider registry
function initializeProviderRegistry(): void {
  // Register Anthropic provider (now with integrated caching)
  ProviderRegistry.register(
    "anthropic",
    new SimpleProviderFactory(AnthropicProvider, undefined, 1),
    {
      description: "Anthropic Claude provider with optional caching",
      features: {
        tools: true,
        streaming: false,
        caching: true, // Now supports caching based on config
        multimodal: true,
      },
    }
  );

  // Register OpenAI provider
  ProviderRegistry.register(
    "openai",
    new SimpleProviderFactory(
      OpenAIProvider,
      ["gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
      1
    ),
    {
      description: "OpenAI GPT provider",
      features: {
        tools: true,
        streaming: true,
        caching: false,
        multimodal: true,
      },
    }
  );

  // Register OpenRouter provider
  ProviderRegistry.register(
    "openrouter",
    new SimpleProviderFactory(OpenRouterProvider, undefined, 1),
    {
      description: "OpenRouter multi-model provider",
      features: {
        tools: true,
        streaming: true,
        caching: true,
        multimodal: false,
      },
    }
  );

  // Register Ollama provider
  ProviderRegistry.register(
    "ollama",
    new SimpleProviderFactory(
      OllamaProvider,
      ["llama3.2", "llama3.1", "llama3", "codellama", "mistral", "mixtral"],
      1
    ),
    {
      description: "Ollama local model provider",
      features: {
        tools: true,
        streaming: true,
        caching: false,
        multimodal: false,
      },
    }
  );

  logger.debug("LLM provider registry initialized");
}

// Initialize the registry on module load
initializeProviderRegistry();

// Factory function - no longer needs tool registry
export function createLLMProvider(config: LLMConfig): LLMProvider {
  try {
    // Create provider using registry
    const provider = ProviderRegistry.create(config);

    logger.debug(`Created LLM provider: ${config.provider}`);
    return provider;
  } catch (error) {
    // Fallback to legacy creation for backward compatibility
    logger.warn(`Registry creation failed, falling back to legacy: ${error}`);
    return createLegacyProvider(config);
  }
}

// Legacy provider creation for backward compatibility
function createLegacyProvider(config: LLMConfig): LLMProvider {
  // Include caching preference in cache key
  const cacheKey = `${config.provider}-${config.model}-${config.baseURL || "default"}-${config.enableCaching !== false}`;

  // Return cached provider if exists
  const cached = legacyProviders.get(cacheKey);
  if (cached) {
    return cached;
  }

  let provider: LLMProvider;

  switch (config.provider.toLowerCase()) {
    case "anthropic":
      provider = new AnthropicProvider();
      break;
    case "openai":
      provider = new OpenAIProvider();
      break;
    case "openrouter":
      provider = new OpenRouterProvider();
      break;
    case "ollama":
      provider = new OllamaProvider();
      break;
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }

  // Cache the provider
  legacyProviders.set(cacheKey, provider);

  logger.debug(`Created legacy LLM provider: ${config.provider}`);
  return provider;
}

export function clearLLMProviderCache(): void {
  ProviderRegistry.clearCache();
  legacyProviders.clear();
  logger.debug("Cleared LLM provider caches");
}

export function getSupportedProviders(): string[] {
  return ProviderRegistry.getSupportedProviders();
}

export function getProvidersByFeature(
  feature: "tools" | "streaming" | "caching" | "multimodal"
): string[] {
  // @ts-expect-error Type mismatch between keyof inference
  return ProviderRegistry.getProvidersByFeature(feature);
}

export function validateProviderConfig(config: LLMConfig): { valid: boolean; issues: string[] } {
  return ProviderRegistry.validateProvider(config.provider, config);
}

// Export registry for advanced usage
export { ProviderRegistry } from "./registry/ProviderRegistry";
