import { configService } from "@/services";
import { logger } from "@/utils/logger";
import { igniteEngine, loadModels } from "multi-llm-ts";
import { ToolPlugin } from "./ToolPlugin";
import { getLLMLogger, initializeLLMLogger } from "./callLogger";
import type {
    CompletionRequest,
    CompletionResponse,
    LLMConfig,
    LLMService,
    StreamEvent,
} from "./types";

export interface LLMRouterConfig {
    configs: Record<string, LLMConfig>;
    defaults: {
        agents?: string;
        analyze?: string;
        orchestrator?: string;
        [key: string]: string | undefined;
    };
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
        // Check if configName is a defaults reference (e.g., "defaults.analyze")
        if (context?.configName?.startsWith("defaults.")) {
            const defaultKey = context.configName.substring("defaults.".length);
            const configKey = this.config.defaults[defaultKey];
            if (configKey && this.config.configs[configKey]) {
                return configKey;
            }
            // If the default key doesn't exist or point to a valid config, continue to other logic
        }

        // Direct config name takes precedence
        if (context?.configName && this.config.configs[context.configName]) {
            return context.configName;
        }

        const key =
            this.config.defaults.agents ??
            this.config.defaults.analyze ??
            this.config.defaults.orchestrator ??
            Object.keys(this.config.configs)[0];

        // Fallback to first available config
        if (!key) {
            throw new Error("No LLM configurations available");
        }

        return key;
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
        logger.info("[LLM] Starting completion request", {
            requestedConfigName: context.configName,
            resolvedConfigKey: configKey,
            provider: config.provider,
            model: config.model,
            agentName: context.agentName,
            messageCount: request.messages.length,
            messages: request.messages.map((m) => ({
                content: m.content.substring(0, 50),
                role: m.role,
            })),
            requestId: `${configKey}-${Date.now()}`,
        });

        // Trace system prompt if present
        const systemMessage = request.messages.find((m) => m.role === "system");
        if (systemMessage) {
            logger.debug("[LLM] System prompt", {
                configKey,
                systemPrompt: systemMessage.content,
                length: systemMessage.content.length,
            });
        }

        // Trace all messages
        logger.debug("[LLM] Request messages", {
            configKey,
            messages: request.messages.map((msg, index) => ({
                index,
                role: msg.role,
                contentLength: msg.content.length,
                contentPreview:
                    msg.content.substring(0, 200) + (msg.content.length > 200 ? "..." : ""),
            })),
        });

        let response: CompletionResponse | undefined;
        let error: Error | undefined;

        try {
            // Use the multi-llm-ts v4 API
            const llmConfig = {
                apiKey: config.apiKey,
                baseURL: config.baseUrl,
            };

            const llm = igniteEngine(config.provider, llmConfig);

            // Register tools as plugins if provided
            if (request.tools && request.toolContext) {
                for (const tool of request.tools) {
                    llm.addPlugin(new ToolPlugin(tool, request.toolContext));
                }
            }

            const models = await loadModels(config.provider, llmConfig);

            if (!models || !models.chat || models.chat.length === 0) {
                throw new Error(`No models available for provider ${config.provider}`);
            }

            // Find the specific model - handle both string and ChatModel types
            const model =
                models.chat.find((m) => {
                    const modelId = typeof m === "string" ? m : m.id;
                    return modelId === config.model;
                }) || models.chat[0];
            if (!model) {
                throw new Error(`Model ${config.model} not found for provider ${config.provider}`);
            }

            // Execute completion with API
            console.log(
                "CALLING LLM ****COMPLETE****",
                request.messages[request.messages.length - 1]?.content.substring(0, 100)
            );
            response = await llm.complete(model, request.messages, {
                usage: true,
                caching: true,
            });

            // Model metadata is available in the model object if needed for future use
            // Not mutating the response object to maintain clean types

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Trace response details with all metadata
            logger.info("[LLM] Completion response received", {
                configKey,
                duration: `${duration}ms`,
                responseType: typeof response,
                content: response.content,
                contentLength: response.content?.length || 0,
                hasToolCalls: !!response.toolCalls?.length,
                toolCallCount: response.toolCalls?.length || 0,
                usage: response.usage,
            });

            // Log complete response metadata
            logger.info("[LLM] Complete response metadata", {
                configKey,
                fullResponse: JSON.stringify(response, null, 2),
                responseKeys: Object.keys(response),
                type: response.type,
                originalPrompt: response.original_prompt,
                revisedPrompt: response.revised_prompt,
                url: response.url,
                usage: response.usage
                    ? {
                          promptTokens: response.usage.prompt_tokens,
                          completionTokens: response.usage.completion_tokens,
                          totalTokens: response.usage.total_tokens,
                          cacheCreationInputTokens: response.usage.cache_creation_input_tokens,
                          cacheReadInputTokens: response.usage.cache_read_input_tokens,
                      }
                    : undefined,
                toolCalls: response.toolCalls?.map((tc) => ({
                    name: tc.name,
                    params: tc.params,
                    rawParams: JSON.stringify(tc.params),
                })),
            });

            // Trace response content
            if (response.content) {
                logger.debug("[LLM] Response content", {
                    configKey,
                    content: response.content,
                    contentLength: response.content.length,
                });
            }

            // Trace tool calls if present
            if (response.toolCalls?.length) {
                logger.debug("[LLM] Tool calls", {
                    configKey,
                    toolCalls: response.toolCalls.map((tc) => ({
                        name: tc.name,
                        paramsLength: JSON.stringify(tc.params).length,
                    })),
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

            logger.error("[LLM] Completion failed", {
                configKey,
                duration: `${duration}ms`,
                error: error.message,
                stack: error.stack,
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

    async *stream(request: CompletionRequest): AsyncIterable<StreamEvent> {
        const configKey = this.resolveConfigKey(request.options);
        const config = this.config.configs[configKey];
        if (!config) {
            throw new Error(`LLM configuration not found: ${configKey}`);
        }

        const startTime = Date.now();
        logger.info("ℹ️ [LLM] Starting streaming request", {
            model: config.model,
            agentName: request.options?.agentName,
            messageCount: request.messages.length,
            messages: request.messages.map((m) => ({
                content: m.content.substring(0, 50),
                role: m.role,
            })),
        });

        try {
            const llmConfig = {
                apiKey: config.apiKey,
                baseURL: config.baseUrl,
            };

            const llm = igniteEngine(config.provider, llmConfig);

            // Register tools as plugins if provided
            if (request.tools && request.toolContext) {
                for (const tool of request.tools) {
                    llm.addPlugin(new ToolPlugin(tool, request.toolContext));
                }
            }

            const models = await loadModels(config.provider, llmConfig);

            if (!models || !models.chat || models.chat.length === 0) {
                throw new Error(`No models available for provider ${config.provider}`);
            }

            // Find the specific model
            const model =
                models.chat.find((m) => {
                    const modelId = typeof m === "string" ? m : m.id;
                    return modelId === config.model;
                }) || models.chat[0];
            if (!model) {
                throw new Error(`Model ${config.model} not found for provider ${config.provider}`);
            }

            console.log(
                "CALLING LLM",
                request.messages[request.messages.length - 1]?.content.substring(0, 100)
            );

            // Use generate() for streaming
            const stream = llm.generate(model, request.messages, {
                usage: true,
                caching: config.enableCaching ?? true,
            });

            let fullContent = "";
            let lastResponse: CompletionResponse | undefined;
            const chunkMetadata: any[] = [];

            for await (const chunk of stream) {
                // Log chunk metadata
                const chunkInfo = {
                    type: chunk.type,
                    chunkKeys: Object.keys(chunk),
                    fullChunk: JSON.stringify(chunk),
                };
                chunkMetadata.push(chunkInfo);

                if (chunk.type === "content" || chunk.type === "reasoning") {
                    fullContent += chunk.text;
                    yield { type: "content", content: chunk.text };
                } else if (chunk.type === "tool") {
                    if (chunk.status === "calling" && chunk.call?.params) {
                        yield {
                            type: "tool_start",
                            tool: chunk.name,
                            args: chunk.call.params,
                        };
                    } else if (chunk.done && chunk.call?.result !== undefined) {
                        yield {
                            type: "tool_complete",
                            tool: chunk.name,
                            result: chunk.call.result,
                        };
                    }
                } else if (chunk.type === "usage") {
                    // Build the final response
                    lastResponse = {
                        type: "text",
                        content: fullContent,
                        usage: chunk.usage,
                        toolCalls: [],
                    } as CompletionResponse;

                    // Log usage chunk details
                    logger.info("[LLM] Usage chunk metadata", {
                        configKey,
                        usageChunk: JSON.stringify(chunk, null, 2),
                        usage: chunk.usage,
                    });
                }
            }

            // Log all chunk metadata
            logger.info("[LLM] Stream chunk summary", {
                configKey,
                totalChunks: chunkMetadata.length,
                chunkTypes: chunkMetadata.map((c) => c.type),
                firstFewChunks: chunkMetadata.slice(0, 5),
            });

            const endTime = Date.now();
            const duration = endTime - startTime;

            if (lastResponse) {
                logger.info("✅ [LLM] Streaming completed", {
                    configKey,
                    duration: `${duration}ms`,
                    promptTokens: lastResponse.usage?.prompt_tokens,
                    completionTokens: lastResponse.usage?.completion_tokens,
                    contentLength: fullContent.length,
                });

                // Log complete response metadata
                logger.info("[LLM] Complete streaming response metadata", {
                    configKey,
                    fullResponse: JSON.stringify(lastResponse, null, 2),
                    responseKeys: Object.keys(lastResponse),
                    type: lastResponse.type,
                    originalPrompt: lastResponse.original_prompt,
                    revisedPrompt: lastResponse.revised_prompt,
                    url: lastResponse.url,
                    usage: lastResponse.usage
                        ? {
                              promptTokens: lastResponse.usage.prompt_tokens,
                              completionTokens: lastResponse.usage.completion_tokens,
                              totalTokens: lastResponse.usage.total_tokens,
                              cacheCreationInputTokens:
                                  lastResponse.usage.cache_creation_input_tokens,
                              cacheReadInputTokens: lastResponse.usage.cache_read_input_tokens,
                          }
                        : undefined,
                });

                // Log to comprehensive JSONL logger
                const llmLogger = getLLMLogger();
                if (llmLogger) {
                    await llmLogger.logLLMCall(
                        configKey,
                        config,
                        request,
                        { response: lastResponse },
                        { startTime, endTime }
                    );
                }

                yield { type: "done", response: lastResponse };
            }
        } catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            const errorObj = error instanceof Error ? error : new Error(String(error));

            logger.error("[LLM] Streaming failed", {
                configKey,
                duration: `${duration}ms`,
                error: errorObj.message,
                stack: errorObj.stack,
            });

            // Log to comprehensive JSONL logger
            const llmLogger = getLLMLogger();
            if (llmLogger) {
                await llmLogger.logLLMCall(
                    configKey,
                    config,
                    request,
                    { error: errorObj },
                    { startTime, endTime }
                );
            }

            yield { type: "error", error: errorObj.message };
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
            defaults: tenexLLMs.defaults || { agents: undefined, analyze: undefined },
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
export function createAgentAwareLLMService(router: LLMRouter, agentName: string): LLMService {
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
        stream: async function* (request: CompletionRequest) {
            // Inject agent name into options
            const enhancedRequest = {
                ...request,
                options: {
                    ...request.options,
                    agentName,
                },
            };
            yield* router.stream(enhancedRequest);
        },
    };
}
