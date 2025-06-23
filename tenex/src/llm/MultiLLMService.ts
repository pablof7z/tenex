import { logger } from "@/utils/logger";
import {
  type ChatModel,
  type LlmChunk,
  type LlmCompletionOpts,
  type LlmEngine,
  Message as LlmMessage,
  type LlmResponse,
  type LlmTool,
  type ModelsList,
  igniteEngine,
  loadModels,
  loadOpenRouterModels,
} from "multi-llm-ts";
import type {
  CompletionRequest,
  CompletionResponse,
  LLMConfig,
  LLMService,
  Message,
  StreamChunk,
  ToolCall,
  ToolDefinition,
} from "./types";
import { configService } from "@/services";
import { PROVIDER_ID_MAP } from "./services/LLMModelService";
import type { TenexLLMs } from "@/services/config/types";
import type { Agent } from "@/agents/types";
import { LLM_DEFAULTS, DEFAULT_AGENT_LLM_CONFIG } from "./constants";

const llmLogger = logger.forModule("llm");

/**
 * LLM service implementation using multi-llm-ts
 * Supports both single configuration and multi-configuration with routing
 */
export class MultiLLMService implements LLMService {
  private static projectInstances = new Map<string, MultiLLMService>();
  
  // Single instance mode properties
  private engine?: LlmEngine;
  private config?: LLMConfig;
  private chatModel: ChatModel | null = null;
  
  // Multi instance mode properties
  private llmInstances?: Map<string, MultiLLMService>;
  private llmSettings?: TenexLLMs;
  private isRoutingMode = false;

  constructor(config?: LLMConfig) {
    if (config) {
      // Single instance mode
      this.config = config;
      try {
        const providerName = this.mapProviderName(config.provider);
        llmLogger.debug(
          `Initializing LLM engine for provider: ${providerName}, model: ${config.model}`
        );

        this.engine = igniteEngine(providerName, {
          apiKey: config.apiKey,
          baseURL: config.baseUrl,
        });

        // Try to build the model - multi-llm-ts v4 requires ChatModel objects
        try {
          this.chatModel = this.engine.buildModel(config.model);
          llmLogger.debug(`ChatModel built successfully for ${config.model}`);
        } catch (modelError) {
          // This is expected for some providers like OpenRouter where models need to be loaded first
          llmLogger.debug(`Initial model build skipped for ${config.model}, will load on demand`);
          // Will try to load models later if needed
        }

        llmLogger.debug("LLM engine initialized successfully");
      } catch (error) {
        llmLogger.error(`Failed to initialize LLM engine: ${error}`);
        throw new Error(
          `Failed to initialize LLM engine: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else {
      // Routing mode - will be initialized with initializeForProject
      this.isRoutingMode = true;
    }
  }

  /**
   * Create or retrieve a MultiLLMService instance for a project
   * This creates a routing instance that manages multiple LLM configurations
   */
  static async createForProject(projectPath: string): Promise<LLMService> {
    let instance = MultiLLMService.projectInstances.get(projectPath);
    if (!instance) {
      instance = new MultiLLMService();
      await instance.initializeForProject(projectPath);
      MultiLLMService.projectInstances.set(projectPath, instance);
    }
    return instance;
  }

  /**
   * Clear cached instance for a project (useful for testing)
   */
  static clearProjectInstance(projectPath: string): void {
    MultiLLMService.projectInstances.delete(projectPath);
  }

  private async initializeForProject(projectPath: string): Promise<void> {
    // Load LLM configuration
    const { llms } = await configService.loadConfig(projectPath);
    this.llmSettings = llms;
    this.llmInstances = new Map();

    if (!llms.configurations || Object.keys(llms.configurations).length === 0) {
      throw new Error("No LLM configurations found");
    }

    // Create MultiLLMService instances for each configuration
    for (const [configName, config] of Object.entries(llms.configurations)) {
      const credentials = llms.credentials[config.provider];
      if (!credentials?.apiKey) {
        llmLogger.error(`Missing API key for provider ${config.provider} in config ${configName}`);
        continue;
      }

      const llmInstance = new MultiLLMService({
        provider: config.provider as
          | "anthropic"
          | "openai"
          | "google"
          | "ollama"
          | "mistral"
          | "groq"
          | "openrouter",
        model: config.model,
        apiKey: credentials.apiKey,
        baseUrl: credentials.baseUrl,
        defaultOptions: {
          temperature: config.temperature,
          maxTokens: config.maxTokens,
        },
      });
      
      this.llmInstances.set(configName, llmInstance);
      llmLogger.debug(
        `Initialized LLM instance: ${configName} - provider: ${config.provider}, model: ${config.model}`
      );
    }

    if (this.llmInstances.size === 0) {
      throw new Error("No valid LLM configurations could be initialized");
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Handle routing mode
    if (this.isRoutingMode) {
      const configKey = this.getConfigKey(request);
      const llmInstance = this.llmInstances?.get(configKey);
      
      if (!llmInstance) {
        throw new Error(`LLM configuration '${configKey}' not found`);
      }
      
      return llmInstance.complete(request);
    }

    // Single instance mode
    if (!this.engine || !this.config) {
      throw new Error("LLM service not properly initialized");
    }

    try {
      // Ensure we have a ChatModel
      if (!this.chatModel) {
        await this.ensureChatModel();
      }

      const options = this.buildCompletionOptions(request);
      const messages = this.convertMessages(request.messages);

      llmLogger.debug(
        `Sending completion request to ${this.config.provider}/${this.config.model} - ${messages.length} messages: ${JSON.stringify(messages)}`
      );

      // Use ChatModel object instead of string for v4 compatibility
      const response = await this.engine.complete(this.chatModel as ChatModel, messages, options);

      llmLogger.debug(
        `Received completion response - content: ${response.content}, has tool calls: ${!!response.toolCalls}`
      );
      llmLogger.debug(`Raw Response: ${JSON.stringify(response)}`);
      
      // Log specific warning if usage data is missing
      if (!response.usage) {
        llmLogger.warning(
          `No usage data returned from ${this.config.provider}/${this.config.model}. ` +
          `This means LLM metadata tags will not be included in the response.`
        );
      }

      return this.mapResponse(response);
    } catch (error) {
      llmLogger.error(
        `Completion failed - provider: ${this.config.provider}, model: ${this.config.model}, error: ${error instanceof Error ? error.message : error}`
      );
      throw new Error(
        `LLM completion failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    // Handle routing mode
    if (this.isRoutingMode) {
      const configKey = this.getConfigKey(request);
      const llmInstance = this.llmInstances?.get(configKey);
      
      if (!llmInstance) {
        throw new Error(`LLM configuration '${configKey}' not found`);
      }
      
      yield* llmInstance.stream(request);
      return;
    }

    // Single instance mode
    if (!this.engine) {
      throw new Error("LLM service not properly initialized");
    }

    // Ensure we have a ChatModel
    if (!this.chatModel) {
      await this.ensureChatModel();
    }

    const options = this.buildCompletionOptions(request);
    // stream is not part of LlmCompletionOpts, it's a separate parameter

    try {
      const messages = this.convertMessages(request.messages);
      const stream = this.engine.generate(this.chatModel as ChatModel, messages, options);

      for await (const chunk of stream) {
        yield this.mapStreamChunk(chunk);
      }
    } catch (error) {
      llmLogger.error("Stream failed", error);
      throw new Error(
        `LLM stream failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Determine which LLM configuration to use based on request context
   */
  private getConfigKey(request: CompletionRequest | string): string {
    // Handle string requests (direct config key)
    if (typeof request === "string") {
      // Special handling for "default" or the constant - map to defaults.agents
      if (request === "default" || request === DEFAULT_AGENT_LLM_CONFIG) {
        return this.getDefaultConfigKey();
      }
      return request;
    }

    // Check if model is specified in options (clean interface approach)
    if (request.options?.model) {
      // Special handling for "default" or the constant - map to defaults.agents
      if (request.options.model === "default" || request.options.model === DEFAULT_AGENT_LLM_CONFIG) {
        return this.getDefaultConfigKey();
      }
      return request.options.model;
    }

    // Return default configuration key
    return this.getDefaultConfigKey();
  }

  /**
   * Get the default configuration key based on settings and available instances
   */
  private getDefaultConfigKey(): string {
    if (!this.llmSettings) {
      return "default";
    }

    // Check for explicit defaults in settings
    const explicitDefault = this.llmSettings.defaults?.[LLM_DEFAULTS.AGENTS] || this.llmSettings.defaults?.[LLM_DEFAULTS.AGENT_ROUTING];
    if (explicitDefault) {
      return explicitDefault;
    }

    // Fall back to first available instance
    if (this.llmInstances && this.llmInstances.size > 0) {
      return Array.from(this.llmInstances.keys())[0] || "default";
    }

    return "default";
  }

  /**
   * Create an LLM service with agent context for proper routing
   */
  createAgentAwareLLMService(agent?: Agent): LLMService {
    if (!this.isRoutingMode) {
      return this;
    }

    const self = this;
    return {
      async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const configKey = agent?.llmConfig || self.getDefaultConfigKey();
        const llmInstance = self.llmInstances?.get(configKey);
        
        if (!llmInstance) {
          throw new Error(`LLM configuration '${configKey}' not found`);
        }
        
        return llmInstance.complete(request);
      },

      async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
        const configKey = agent?.llmConfig || self.getDefaultConfigKey();
        const llmInstance = self.llmInstances?.get(configKey);
        
        if (!llmInstance) {
          throw new Error(`LLM configuration '${configKey}' not found`);
        }
        
        yield* llmInstance.stream(request);
      },
    };
  }

  private async ensureChatModel(): Promise<void> {
    if (this.chatModel || !this.engine || !this.config) return;

    try {
      // Try to load models from the provider
      const models = await this.loadModelsForProvider();
      if (models?.chat?.length && models.chat.length > 0) {
        // Find our model in the list
        const modelId = this.config.model.toLowerCase();
        const foundModel =
          models.chat.find(
            (m) => m.id.toLowerCase() === modelId || m.name.toLowerCase() === modelId
          ) || models.chat[0]; // Fallback to first available
        this.chatModel = foundModel || null;

        if (this.chatModel) {
          llmLogger.debug(`Using ChatModel: ${this.chatModel.id}`);
        }
      } else {
        // Last resort: try to build it directly
        this.chatModel = this.engine.buildModel(this.config.model);
      }
    } catch (error) {
      llmLogger.error(`Failed to ensure ChatModel: ${error}`);
      // Final fallback: create a minimal ChatModel
      this.chatModel = {
        id: this.config.model,
        name: this.config.model,
        capabilities: {
          vision: false,
          tools: true,
          reasoning: false,
          caching: false,
        },
      };
    }
  }

  private convertMessages(messages: Message[]): LlmMessage[] {
    return messages.map((msg) => new LlmMessage(msg.role, msg.content));
  }

  private buildCompletionOptions(request: CompletionRequest): LlmCompletionOpts {
    const opts: LlmCompletionOpts = {
      // Always request usage data
      usage: true
    };

    // Apply default options first
    if (this.config?.defaultOptions) {
      if (this.config.defaultOptions.temperature !== undefined) {
        opts.temperature = this.config.defaultOptions.temperature;
      }
      if (this.config.defaultOptions.maxTokens !== undefined) {
        opts.maxTokens = this.config.defaultOptions.maxTokens;
      }
    }

    // Override with request-specific options
    if (request.options) {
      if (request.options.temperature !== undefined) {
        opts.temperature = request.options.temperature;
      }
      if (request.options.maxTokens !== undefined) {
        opts.maxTokens = request.options.maxTokens;
      }
      if (request.options.tools) {
        // multi-llm-ts expects boolean for tools
        opts.tools = true;
      }
      // stream is handled separately, not in options
    }

    return opts;
  }

  private mapTools(
    tools: ToolDefinition[]
  ): Array<{ type: string; function: { name: string; description: string; parameters: unknown } }> {
    return tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  private mapResponse(response: LlmResponse): CompletionResponse {
    const result: CompletionResponse = {
      content: response.content || "",
      model: this.config?.model || "unknown", // Use the configured model
    };

    if (response.usage) {
      // multi-llm-ts uses underscore property names
      const usage = response.usage as any;
      result.usage = {
        promptTokens: usage.prompt_tokens || usage.promptTokens || 0,
        completionTokens: usage.completion_tokens || usage.completionTokens || 0,
        totalTokens:
          usage.total_tokens ||
          usage.totalTokens ||
          (usage.prompt_tokens || usage.promptTokens || 0) +
            (usage.completion_tokens || usage.completionTokens || 0),
      };
    }

    if (response.toolCalls && response.toolCalls.length > 0) {
      result.toolCalls = response.toolCalls.map((call) => {
        const toolCall = call as { id?: string; name?: string; params?: unknown };
        return {
          id: toolCall.id || crypto.randomUUID(),
          name: toolCall.name || "",
          arguments: (toolCall.params || {}) as Record<string, unknown>,
        };
      });
    }

    return result;
  }

  private mapStreamChunk(chunk: LlmChunk): StreamChunk {
    return {
      content: chunk.type === "content" ? chunk.text || "" : "",
      isComplete: chunk.type === "content" ? chunk.done || false : false,
    };
  }

  private mapProviderName(provider: LLMConfig["provider"]): string {
    return PROVIDER_ID_MAP[provider] || provider;
  }

  private async loadModelsForProvider(): Promise<ModelsList | null> {
    if (!this.config) return null;

    const engineConfig = {
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl,
    };

    try {
      // Use specific loader for OpenRouter
      if (this.config.provider === "openrouter") {
        llmLogger.debug("Loading OpenRouter models");
        return await loadOpenRouterModels(engineConfig);
      }

      // Generic loader for other providers
      const providerName = this.mapProviderName(this.config.provider);
      llmLogger.debug(`Loading models for provider: ${providerName}`);
      return await loadModels(providerName, engineConfig);
    } catch (error) {
      llmLogger.warning(`Failed to load models for ${this.config.provider}: ${error}`);
      return null;
    }
  }
}
