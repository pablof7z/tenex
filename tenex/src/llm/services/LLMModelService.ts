import { loadModels } from "multi-llm-ts";
import { logger } from "@/utils/logger";
import chalk from "chalk";
import type { LLMProvider } from "@/llm/types";

/**
 * Service responsible for fetching and managing LLM models
 * Centralizes all model-related operations
 */

// Provider-specific types
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
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

export interface ModelInfo {
  id: string;
  name?: string;
  supportsCaching?: boolean;
}

// Centralized provider ID mapping
export const PROVIDER_ID_MAP: Record<string, string> = {
  anthropic: "anthropic",
  openai: "openai",
  google: "google",
  groq: "groq",
  deepseek: "deepseek",
  ollama: "ollama",
  openrouter: "openrouter",
  mistral: "mistralai",
};

// Fallback models when API is not available
const FALLBACK_MODELS: Record<string, string[]> = {
  anthropic: [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
  ],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
  google: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
  groq: ["llama-3.1-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
  deepseek: ["deepseek-chat", "deepseek-coder"],
  mistral: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"],
  ollama: ["llama3.2", "llama3.1", "codellama", "mistral", "gemma2", "qwen2.5"],
};

// Simple in-memory cache
interface CacheEntry {
  models: string[];
  timestamp: number;
}

class LLMModelService {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Get the multi-llm-ts provider ID for our provider name
   */
  getProviderId(provider: string): string {
    return PROVIDER_ID_MAP[provider] || provider;
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(entry: CacheEntry | undefined): boolean {
    if (!entry) return false;
    return Date.now() - entry.timestamp < this.cacheTimeout;
  }

  /**
   * Fetch models for a provider with caching
   */
  async fetchModels(provider: string, apiKey?: string): Promise<string[]> {
    const cacheKey = `${provider}-${apiKey ? 'with-key' : 'no-key'}`;
    const cached = this.cache.get(cacheKey);
    
    if (this.isCacheValid(cached)) {
      logger.debug(`Using cached models for ${provider}`);
      return cached!.models;
    }

    try {
      const providerId = this.getProviderId(provider);
      const config = apiKey ? { apiKey } : {};
      
      logger.info(chalk.cyan(`🔍 Fetching ${provider} models...`));
      const models = await loadModels(providerId, config);
      
      if (models && models.chat && models.chat.length > 0) {
        // Extract model IDs from the chat models
        const modelIds = models.chat.map((model: any) => 
          typeof model === 'string' ? model : model.id || model.name || String(model)
        );
        
        logger.info(chalk.green(`✅ Found ${modelIds.length} models from API`));
        
        // Cache the results
        this.cache.set(cacheKey, {
          models: modelIds,
          timestamp: Date.now()
        });
        
        return modelIds;
      }
      
      // Fall back to default models if none found
      logger.info(chalk.yellow(`⚠️  No models found from API, using defaults`));
      return FALLBACK_MODELS[provider] || [];
    } catch (error) {
      logger.warn(`Could not fetch ${provider} models: ${error}`);
      // Return fallback models on error
      return FALLBACK_MODELS[provider] || [];
    }
  }

  /**
   * Fetch OpenRouter models with full metadata (pricing, caching support, etc.)
   */
  async fetchOpenRouterModelsWithMetadata(): Promise<OpenRouterModelWithMetadata[]> {
    try {
      // First check if OpenRouter is accessible
      const models = await loadModels("openrouter", {});
      
      if (models && models.chat && models.chat.length > 0) {
        // Fetch full metadata for pricing info
        const response = await fetch("https://openrouter.ai/api/v1/models", {
          headers: {
            "HTTP-Referer": "https://tenex.dev",
            "X-Title": "TENEX CLI",
          },
        });

        if (response.ok) {
          const data = (await response.json()) as OpenRouterModelsResponse;
          return data.data
            .filter((model) => {
              // Check if model supports text input and output
              const hasTextInput = model.input_modalities?.includes("text") ?? true;
              const hasTextOutput = model.output_modalities?.includes("text") ?? true;
              return hasTextInput && hasTextOutput;
            })
            .map((model) => ({
              id: model.id,
              name: model.name,
              supportsCaching: !!(model.pricing.input_cache_read && model.pricing.input_cache_write),
              promptPrice: Number.parseFloat(model.pricing.prompt) * 1000000, // Convert to price per 1M tokens
              completionPrice: Number.parseFloat(model.pricing.completion) * 1000000,
              cacheReadPrice: model.pricing.input_cache_read
                ? Number.parseFloat(model.pricing.input_cache_read) * 1000000
                : undefined,
              cacheWritePrice: model.pricing.input_cache_write
                ? Number.parseFloat(model.pricing.input_cache_write) * 1000000
                : undefined,
            }))
            .sort((a, b) => a.id.localeCompare(b.id));
        }
      }
      
      throw new Error("Could not fetch OpenRouter models");
    } catch (error) {
      logger.warn(`Could not fetch OpenRouter models: ${error}`);
      // Return common OpenRouter models as fallback
      return [
        {
          id: "anthropic/claude-3.5-sonnet",
          name: "Claude 3.5 Sonnet",
          supportsCaching: true,
          promptPrice: 3,
          completionPrice: 15,
        },
        {
          id: "openai/gpt-4o",
          name: "GPT-4o",
          supportsCaching: false,
          promptPrice: 5,
          completionPrice: 15,
        },
      ];
    }
  }

  /**
   * Clear the cache for a specific provider or all providers
   */
  clearCache(provider?: string): void {
    if (provider) {
      // Clear both with-key and no-key entries for the provider
      this.cache.delete(`${provider}-with-key`);
      this.cache.delete(`${provider}-no-key`);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get fallback models for a provider
   */
  getFallbackModels(provider: string): string[] {
    return FALLBACK_MODELS[provider] || [];
  }

  /**
   * Check if we're using fallback models
   */
  isUsingFallback(provider: string, models: string[]): boolean {
    const fallbacks = this.getFallbackModels(provider);
    return JSON.stringify(models) === JSON.stringify(fallbacks);
  }
}

// Export singleton instance
export const llmModelService = new LLMModelService();