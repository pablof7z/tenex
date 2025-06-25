import type { ChatModel } from "multi-llm-ts";
import {
    igniteEngine,
    loadModels,
} from "multi-llm-ts";
import type { LLMConfig, CompletionRequest, CompletionResponse, LLMService } from "./types";
import { logger } from "@/utils/logger";
import { configService } from "@/services";
import { getLLMLogger, initializeLLMLogger } from "./callLogger";

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
        const startTime = Date.now();
        
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

        // Trace request details
        logger.info(`[LLM] Starting completion request`, {
            configKey,
            provider: config.provider,
            model: config.model,
            agentName: context.agentName,
            messageCount: request.messages.length,
            lastMessage: request.messages[request.messages.length-1],
            requestId: `${configKey}-${Date.now()}`
        });

        // Trace system prompt if present
        const systemMessage = request.messages.find(m => m.role === 'system');
        if (systemMessage) {
            logger.debug(`[LLM] System prompt`, {
                configKey,
                systemPrompt: systemMessage.content,
                length: systemMessage.content.length
            });
        }

        // Trace all messages
        logger.debug(`[LLM] Request messages`, {
            configKey,
            messages: request.messages.map((msg, index) => ({
                index,
                role: msg.role,
                contentLength: msg.content.length,
                contentPreview: msg.content.substring(0, 200) + (msg.content.length > 200 ? '...' : '')
            }))
        });

        let response: CompletionResponse | undefined;
        let error: Error | undefined;

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
            response = await llm.complete(model, request.messages, {
                usage: true,
                caching: true
            });
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Trace response details
            logger.info(`[LLM] Completion response received`, {
                configKey,
                duration: `${duration}ms`,
                responseType: typeof response,
                content: response.content,
                contentLength: response.content?.length || 0,
                hasToolCalls: !!response.toolCalls?.length,
                toolCallCount: response.toolCalls?.length || 0,
                usage: response.usage
            });

            // Trace response content
            if (response.content) {
                logger.debug(`[LLM] Response content`, {
                    configKey,
                    content: response.content,
                    contentLength: response.content.length
                });
            }

            // Trace tool calls if present
            if (response.toolCalls?.length) {
                logger.debug(`[LLM] Tool calls`, {
                    configKey,
                    toolCalls: response.toolCalls.map(tc => ({
                        id: tc.id,
                        name: tc.name,
                        argsLength: JSON.stringify(tc.args).length
                    }))
                });
            }

            // Log to comprehensive JSONL logger
            const llmLogger = getLLMLogger();
            if (llmLogger) {
                await llmLogger.logLLMCall(
                    configKey,
                    config,
                    request,
                    { response },
                    { startTime, endTime }
                );
            }
            
            return response;
            
        } catch (caughtError) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            error = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
            
            logger.error(`[LLM] Completion failed`, {
                configKey,
                duration: `${duration}ms`,
                error: error.message,
                stack: error.stack
            });

            // Log to comprehensive JSONL logger
            const llmLogger = getLLMLogger();
            if (llmLogger) {
                await llmLogger.logLLMCall(
                    configKey,
                    config,
                    request,
                    { error },
                    { startTime, endTime }
                );
            }
            
            throw error;
        }
    }
}

/**
 * Load LLM router from configuration file
 */
export async function loadLLMRouter(projectPath: string): Promise<LLMRouter> {
    try {
        // Initialize comprehensive LLM logger
        initializeLLMLogger(projectPath);
        
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