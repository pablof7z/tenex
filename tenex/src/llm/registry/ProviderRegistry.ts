import { ToolEnabledProvider } from "@/llm/ToolEnabledProvider";
import type { LLMProvider } from "@/llm/types";
import type { ToolRegistry } from "@/utils/agents/tools/ToolRegistry";
import type { LLMConfig } from "@/utils/agents/types";
import { logger } from "@tenex/shared/logger";

export interface ProviderFactory {
    create(): LLMProvider;
    supports(config: LLMConfig): boolean;
    priority?: number; // Higher priority providers are preferred
}

export interface ProviderInfo {
    name: string;
    factory: ProviderFactory;
    description?: string;
    features?: {
        tools?: boolean;
        streaming?: boolean;
        caching?: boolean;
        multimodal?: boolean;
    };
}

export class ProviderRegistry {
    private static providers = new Map<string, ProviderInfo>();
    private static instances = new Map<string, LLMProvider>();

    static register(name: string, factory: ProviderFactory, info?: Partial<ProviderInfo>): void {
        const providerInfo: ProviderInfo = {
            name,
            factory,
            description: info?.description || `${name} LLM provider`,
            features: info?.features || {
                tools: true,
                streaming: false,
                caching: false,
                multimodal: false,
            },
        };

        ProviderRegistry.providers.set(name.toLowerCase(), providerInfo);
        logger.debug(`Registered LLM provider: ${name}`);
    }

    static create(config: LLMConfig, toolRegistry?: ToolRegistry): LLMProvider {
        const cacheKey = ProviderRegistry.getCacheKey(config, toolRegistry);

        // Return cached instance if available
        if (ProviderRegistry.instances.has(cacheKey)) {
            return ProviderRegistry.instances.get(cacheKey)!;
        }

        const providerInfo = ProviderRegistry.getProviderInfo(config.provider);
        if (!providerInfo) {
            throw new Error(`Unknown LLM provider: ${config.provider}`);
        }

        if (!providerInfo.factory.supports(config)) {
            throw new Error(`Provider ${config.provider} does not support the given configuration`);
        }

        let provider = providerInfo.factory.create();

        // Wrap with tool-enabled provider if tools are needed
        if (toolRegistry && providerInfo.features?.tools) {
            provider = new ToolEnabledProvider(
                provider,
                toolRegistry,
                config.provider as "anthropic" | "openai" | "openrouter"
            );
        }

        ProviderRegistry.instances.set(cacheKey, provider);
        logger.debug(`Created LLM provider instance: ${config.provider}`);

        return provider;
    }

    static getProviderInfo(provider: string): ProviderInfo | undefined {
        return ProviderRegistry.providers.get(provider.toLowerCase());
    }

    static getSupportedProviders(): string[] {
        return Array.from(ProviderRegistry.providers.keys());
    }

    static getProvidersByFeature(feature: keyof ProviderInfo["features"]): string[] {
        return Array.from(ProviderRegistry.providers.entries())
            .filter(([_, info]) => info.features?.[feature])
            .map(([name]) => name);
    }

    static findBestProvider(
        config: LLMConfig,
        requiredFeatures?: Array<keyof ProviderInfo["features"]>
    ): string | null {
        const candidates = Array.from(ProviderRegistry.providers.entries())
            .filter(([_, info]) => {
                // Check if provider supports the config
                if (!info.factory.supports(config)) return false;

                // Check if provider has required features
                if (requiredFeatures) {
                    return requiredFeatures.every((feature) => info.features?.[feature]);
                }

                return true;
            })
            .sort(([_, a], [__, b]) => (b.factory.priority || 0) - (a.factory.priority || 0));

        return candidates.length > 0 ? candidates[0]![0] : null;
    }

    static clearCache(): void {
        ProviderRegistry.instances.clear();
        logger.debug("Cleared LLM provider instance cache");
    }

    static clearProvider(provider: string): void {
        const keysToDelete = Array.from(ProviderRegistry.instances.keys()).filter((key) =>
            key.startsWith(`${provider.toLowerCase()}:`)
        );

        for (const key of keysToDelete) {
            ProviderRegistry.instances.delete(key);
        }

        logger.debug(`Cleared cached instances for provider: ${provider}`);
    }

    static unregister(provider: string): boolean {
        const result = ProviderRegistry.providers.delete(provider.toLowerCase());
        if (result) {
            ProviderRegistry.clearProvider(provider);
            logger.debug(`Unregistered LLM provider: ${provider}`);
        }
        return result;
    }

    static isProviderRegistered(provider: string): boolean {
        return ProviderRegistry.providers.has(provider.toLowerCase());
    }

    static getRegistryInfo(): Array<{
        name: string;
        description: string;
        features: ProviderInfo["features"];
    }> {
        return Array.from(ProviderRegistry.providers.values()).map((info) => ({
            name: info.name,
            description: info.description || "No description",
            features: info.features,
        }));
    }

    private static getCacheKey(config: LLMConfig, toolRegistry?: ToolRegistry): string {
        const configKey = `${config.provider}:${config.model}:${config.apiKey?.substring(0, 8)}`;
        const toolKey = toolRegistry ? `:tools:${toolRegistry.constructor.name}` : "";
        return configKey + toolKey;
    }

    // Validation helper
    static validateProvider(
        provider: string,
        config: LLMConfig
    ): { valid: boolean; issues: string[] } {
        const issues: string[] = [];

        if (!ProviderRegistry.isProviderRegistered(provider)) {
            issues.push(`Provider '${provider}' is not registered`);
            return { valid: false, issues };
        }

        const providerInfo = ProviderRegistry.getProviderInfo(provider)!;

        if (!providerInfo.factory.supports(config)) {
            issues.push(`Provider '${provider}' does not support the given configuration`);
        }

        return {
            valid: issues.length === 0,
            issues,
        };
    }
}

// Default provider factory implementations
export class SimpleProviderFactory implements ProviderFactory {
    constructor(
        private ProviderClass: new () => LLMProvider,
        private supportedModels?: string[],
        public priority = 0
    ) {}

    create(): LLMProvider {
        return new this.ProviderClass();
    }

    supports(config: LLMConfig): boolean {
        if (this.supportedModels && config.model) {
            return this.supportedModels.includes(config.model);
        }
        return true; // Support any model if no restrictions
    }
}

export class ConditionalProviderFactory implements ProviderFactory {
    constructor(
        private ProviderClass: new () => LLMProvider,
        private condition: (config: LLMConfig) => boolean,
        public priority = 0
    ) {}

    create(): LLMProvider {
        return new this.ProviderClass();
    }

    supports(config: LLMConfig): boolean {
        return this.condition(config);
    }
}
