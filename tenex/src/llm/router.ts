import type { ChatModel } from "multi-llm-ts";
import {
    igniteEngine,
    loadModels,
} from "multi-llm-ts";
import type { LLMConfig, CompletionRequest, CompletionResponse, LLMService } from "./types";
import { logger } from "@/utils/logger";
import { configService } from "@/services";

export interface LLMRouterConfig {
    configs: Record<string, LLMConfig>;
}

/**
 * Simple LLM router that manages multiple LLM instances
 */
export class LLMRouter implements LLMService {
    constructor(private config: LLMRouterConfig) {}

    /**
     * Resolve which configuration to use based on context
     */
    private resolveConfigKey(context?: { agentName?: string; configName?: string }): string {
        // Direct config name takes precedence
        if (context?.configName && this.config.configs[context.configName]) {
            return context.configName;
        }

        // Fallback to first available config
        const firstKey = Object.keys(this.config.configs)[0];
        if (!firstKey) {
            throw new Error("No LLM configurations available");
        }

        return firstKey;
    }

    /**
     * Get available configuration keys
     */
    getConfigKeys(): string[] {
        return Object.keys(this.config.configs);
    }

    /**
     * Complete a request using the appropriate LLM
     */
    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        // Extract context from request options
        const context = {
            configName: request.options?.configName,
            agentName: request.options?.agentName,
        };

        // Get the configuration key
        const configKey = this.resolveConfigKey(context);
        const config = this.config.configs[configKey];
        
        if (!config) {
            throw new Error(`No LLM configuration found for key: ${configKey}`);
        }

        try {
            // Use the new multi-llm-ts v4 API
            const llmConfig = {
                apiKey: config.apiKey,
                baseURL: config.baseUrl,
            };
            
            const llm = igniteEngine(config.provider, llmConfig);
            const models = await loadModels(config.provider, llmConfig);
            
            if (!models || !models.chat || models.chat.length === 0) {
                throw new Error(`No models available for provider ${config.provider}`);
            }
            
            // Find the specific model - handle both string and ChatModel types
            const model = models.chat.find(m => {
                const modelId = typeof m === 'string' ? m : m.id;
                return modelId === config.model;
            }) || models.chat[0];
            if (!model) {
                throw new Error(`Model ${config.model} not found for provider ${config.provider}`);
            }
            
            // Execute completion with new API
            return await llm.complete(model, request.messages);
            
        } catch (error) {
            logger.error(`LLM completion failed for ${configKey}:`, error);
            throw error;
        }
    }
}

/**
 * Load LLM router from configuration file
 */
export async function loadLLMRouter(projectPath: string): Promise<LLMRouter> {
    try {
        // Use configService to load merged global and project-specific configuration
        const { llms: tenexLLMs } = await configService.loadConfig(projectPath);

        // Transform TenexLLMs structure to LLMRouterConfig
        const configs: Record<string, LLMConfig> = {};
        
        // For each configuration, merge in the credentials
        for (const [name, config] of Object.entries(tenexLLMs.configurations)) {
            const provider = config.provider;
            const credentials = tenexLLMs.credentials?.[provider] || {};
            
            configs[name] = {
                ...config,
                apiKey: credentials.apiKey,
                baseUrl: credentials.baseUrl,
            } as LLMConfig;
        }

        const routerConfig: LLMRouterConfig = {
            configs,
        };

        return new LLMRouter(routerConfig);
    } catch (error) {
        logger.error("Failed to load LLM configuration:", error);
        throw error;
    }
}

/**
 * Create an agent-aware LLM service that automatically routes based on agent
 */
export function createAgentAwareLLMService(
    router: LLMRouter,
    agentName: string
): LLMService {
    return {
        complete: async (request: CompletionRequest) => {
            // Inject agent name into options
            const enhancedRequest = {
                ...request,
                options: {
                    ...request.options,
                    agentName,
                },
            };
            return router.complete(enhancedRequest);
        },
    };
}