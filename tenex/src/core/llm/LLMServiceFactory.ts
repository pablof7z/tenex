import { MultiLLMService } from "./MultiLLMService";
import type { LLMConfig, LLMService } from "./types";

/**
 * Factory for creating LLM services
 * Single responsibility: Service instantiation
 */

/**
 * Create an LLM service based on configuration
 */
export function createLLMService(config: LLMConfig): LLMService {
  return new MultiLLMService(config);
}

/**
 * Create multiple services for different models/providers
 */
export function createMultipleLLMServices(configs: LLMConfig[]): Map<string, LLMService> {
  const services = new Map<string, LLMService>();

  for (const config of configs) {
    const key = `${config.provider}:${config.model}`;
    services.set(key, createLLMService(config));
  }

  return services;
}