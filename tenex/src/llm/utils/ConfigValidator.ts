import type { LLMConfig } from "@/utils/agents/types";
import { logger } from "@tenex/shared/logger";

export interface ProviderRequirements {
    providerName: string;
    requiresApiKey: boolean;
    requiresModel: boolean;
    validModels?: string[];
    requiredFields?: string[];
    supportedFeatures?: {
        caching?: boolean;
        tools?: boolean;
        streaming?: boolean;
        multimodal?: boolean;
    };
}

export class LLMProviderError extends Error {
    constructor(
        message: string,
        public readonly provider: string,
        public readonly field?: string
    ) {
        super(message);
        this.name = "LLMProviderError";
    }
}

export class ConfigValidator {
    private static readonly PROVIDER_REQUIREMENTS: Record<string, ProviderRequirements> = {
        anthropic: {
            providerName: "Anthropic",
            requiresApiKey: true,
            requiresModel: true,
            validModels: [
                "claude-3-opus-20240229",
                "claude-3-sonnet-20240229",
                "claude-3-haiku-20240307",
                "claude-3-5-sonnet-20241022",
                "claude-3-5-haiku-20241022",
            ],
            supportedFeatures: {
                caching: true,
                tools: true,
                streaming: true,
                multimodal: true,
            },
        },
        openai: {
            providerName: "OpenAI",
            requiresApiKey: true,
            requiresModel: true,
            validModels: ["gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
            supportedFeatures: {
                caching: false,
                tools: true,
                streaming: true,
                multimodal: true,
            },
        },
        openrouter: {
            providerName: "OpenRouter",
            requiresApiKey: true,
            requiresModel: true,
            supportedFeatures: {
                caching: true,
                tools: true,
                streaming: true,
                multimodal: false,
            },
        },
        ollama: {
            providerName: "Ollama",
            requiresApiKey: false,
            requiresModel: true,
            validModels: ["llama3.2", "llama3.1", "llama3", "codellama", "mistral", "mixtral"],
            supportedFeatures: {
                caching: false,
                tools: true,
                streaming: true,
                multimodal: false,
            },
        },
    };

    static validate(config: LLMConfig): void {
        const requirements = ConfigValidator.getRequirements(config.provider);

        ConfigValidator.validateRequired(config, requirements);
        ConfigValidator.validateModel(config, requirements);
        ConfigValidator.validateFeatures(config, requirements);
        ConfigValidator.validateConfiguration(config, requirements);
    }

    static validatePartial(config: Partial<LLMConfig>): string[] {
        const errors: string[] = [];

        if (!config.provider) {
            errors.push("Provider is required");
            return errors;
        }

        const requirements = ConfigValidator.getRequirements(config.provider);

        if (requirements.requiresApiKey && !config.apiKey) {
            errors.push(`${requirements.providerName} API key is required`);
        }

        if (requirements.requiresModel && !config.model) {
            errors.push(`Model is required for ${requirements.providerName}`);
        }

        if (
            config.model &&
            requirements.validModels &&
            !requirements.validModels.includes(config.model)
        ) {
            errors.push(
                `Model '${config.model}' may not be supported by ${requirements.providerName}`
            );
        }

        return errors;
    }

    static getRequirements(provider: string): ProviderRequirements {
        const requirements = ConfigValidator.PROVIDER_REQUIREMENTS[provider.toLowerCase()];
        if (!requirements) {
            return {
                providerName: provider,
                requiresApiKey: true,
                requiresModel: true,
            };
        }
        return requirements;
    }

    static getSupportedProviders(): string[] {
        return Object.keys(ConfigValidator.PROVIDER_REQUIREMENTS);
    }

    static isProviderSupported(provider: string): boolean {
        return provider.toLowerCase() in ConfigValidator.PROVIDER_REQUIREMENTS;
    }

    static getValidModels(provider: string): string[] | undefined {
        const requirements = ConfigValidator.PROVIDER_REQUIREMENTS[provider.toLowerCase()];
        return requirements?.validModels;
    }

    static supportsFeature(
        provider: string,
        feature: keyof ProviderRequirements["supportedFeatures"]
    ): boolean {
        const requirements = ConfigValidator.PROVIDER_REQUIREMENTS[provider.toLowerCase()];
        return requirements?.supportedFeatures?.[feature] || false;
    }

    private static validateRequired(config: LLMConfig, requirements: ProviderRequirements): void {
        if (requirements.requiresApiKey && !config.apiKey) {
            throw new LLMProviderError(
                `${requirements.providerName} API key is required`,
                config.provider,
                "apiKey"
            );
        }

        if (requirements.requiresModel && !config.model) {
            throw new LLMProviderError(
                `Model is required for ${requirements.providerName}`,
                config.provider,
                "model"
            );
        }

        if (requirements.requiredFields) {
            for (const field of requirements.requiredFields) {
                if (!(field in config) || !config[field as keyof LLMConfig]) {
                    throw new LLMProviderError(
                        `${field} is required for ${requirements.providerName}`,
                        config.provider,
                        field
                    );
                }
            }
        }
    }

    private static validateModel(config: LLMConfig, requirements: ProviderRequirements): void {
        if (!config.model || !requirements.validModels) {
            return;
        }

        if (!requirements.validModels.includes(config.model)) {
            logger.warn(
                `Model '${config.model}' may not be supported by ${requirements.providerName}. ` +
                    `Supported models: ${requirements.validModels.join(", ")}`
            );
        }
    }

    private static validateFeatures(config: LLMConfig, requirements: ProviderRequirements): void {
        if (config.enableCaching && !requirements.supportedFeatures?.caching) {
            logger.warn(
                `Caching is not supported by ${requirements.providerName}, caching will be disabled`
            );
        }

        // Check if tools are being used (this would need to be passed in or checked elsewhere)
        // For now, we'll skip this validation as it requires additional context
    }

    private static validateConfiguration(
        config: LLMConfig,
        requirements: ProviderRequirements
    ): void {
        // Validate temperature range
        if (config.temperature !== undefined) {
            if (config.temperature < 0 || config.temperature > 2) {
                throw new LLMProviderError(
                    "Temperature must be between 0 and 2",
                    config.provider,
                    "temperature"
                );
            }
        }

        // Validate max tokens
        if (config.maxTokens !== undefined) {
            if (config.maxTokens <= 0) {
                throw new LLMProviderError(
                    "Max tokens must be a positive number",
                    config.provider,
                    "maxTokens"
                );
            }

            // Provider-specific max token limits
            const maxLimits: Record<string, number> = {
                anthropic: 200000,
                openai: 128000,
                openrouter: 200000,
                ollama: 32768,
            };

            const maxLimit = maxLimits[config.provider.toLowerCase()];
            if (maxLimit && config.maxTokens > maxLimit) {
                logger.warn(
                    `Max tokens (${config.maxTokens}) exceeds typical limit for ` +
                        `${requirements.providerName} (${maxLimit})`
                );
            }
        }

        // Validate top-p
        if (config.topP !== undefined) {
            if (config.topP < 0 || config.topP > 1) {
                throw new LLMProviderError(
                    "Top-p must be between 0 and 1",
                    config.provider,
                    "topP"
                );
            }
        }

        // Validate frequency penalty
        if (config.frequencyPenalty !== undefined) {
            if (config.frequencyPenalty < -2 || config.frequencyPenalty > 2) {
                throw new LLMProviderError(
                    "Frequency penalty must be between -2 and 2",
                    config.provider,
                    "frequencyPenalty"
                );
            }
        }

        // Validate presence penalty
        if (config.presencePenalty !== undefined) {
            if (config.presencePenalty < -2 || config.presencePenalty > 2) {
                throw new LLMProviderError(
                    "Presence penalty must be between -2 and 2",
                    config.provider,
                    "presencePenalty"
                );
            }
        }
    }
}
