import type { ChatModel } from "multi-llm-ts";
import {
    OpenAI,
    Anthropic,
    Google,
    Groq,
    DeepSeek,
    MistralAI,
    Ollama,
    OpenRouter,
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
    private instances = new Map<string, ChatModel>();
    
    constructor(private config: LLMRouterConfig) {}

    /**
     * Get an LLM instance for the given context
     */
    async getLLM(context?: { agentName?: string; configName?: string }): Promise<ChatModel> {
        const configKey = this.resolveConfigKey(context);
        
        // Return cached instance if available
        if (this.instances.has(configKey)) {
            const instance = this.instances.get(configKey);
            if (!instance) {
                throw new Error(`Cached instance not found for key: ${configKey}`);
            }
            return instance;
        }

        // Create new instance
        const config = this.config.configs[configKey];
        if (!config) {
            throw new Error(`No LLM configuration found for key: ${configKey}`);
        }

        const llm = await this.createProvider(config);
        this.instances.set(configKey, llm);
        
        return llm;
    }

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
     * Create a provider instance based on configuration
     */
    private async createProvider(config: LLMConfig): Promise<ChatModel> {
        switch (config.provider) {
            case "openai":
                return new OpenAI({ apiKey: config.apiKey }) as any;
            case "anthropic":
                return new Anthropic({ apiKey: config.apiKey }) as any;
            case "google":
                return new Google({ apiKey: config.apiKey }) as any;
            case "groq":
                return new Groq({ apiKey: config.apiKey }) as any;
            case "deepseek":
                return new DeepSeek({ apiKey: config.apiKey }) as any;
            case "mistral":
                return new MistralAI({ apiKey: config.apiKey }) as any;
            case "ollama":
                return new Ollama({ baseURL: config.baseUrl || "http://localhost:11434" }) as any;
            case "openrouter":
                return new OpenRouter({ apiKey: config.apiKey }) as any;
            default:
                throw new Error(`Unsupported provider: ${config.provider}`);
        }
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

        // Get the appropriate LLM instance
        const llm = await this.getLLM(context);
        
        // Merge model and other config options with request options
        const completionOptions = {
            model: config.model,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            ...request.options,
        };
        
        // Execute completion directly
        return (llm as any).chat(request.messages, completionOptions);
    }
}

/**
 * Load LLM router from configuration file
 */
export async function loadLLMRouter(configPath: string): Promise<LLMRouter> {
    try {
        // Use configService to load LLM configuration with proper validation
        const tenexLLMs = await configService.loadTenexLLMs(configPath);

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