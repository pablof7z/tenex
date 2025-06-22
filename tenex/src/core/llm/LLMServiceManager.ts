import { MultiLLMService } from "@/core/llm/MultiLLMService";
import type { LLMService, CompletionRequest } from "@/core/llm/types";
import { configService } from "@/services";
import { logger } from "@/utils/logger";
import type { TenexLLMs } from "@/types/config";
import type { Agent } from "@/types/agent";

/**
 * Centralized LLM service manager that handles:
 * - Loading LLM configurations
 * - Creating MultiLLMService instances for each configuration
 * - Routing requests to the appropriate LLM instance based on context
 * 
 * This eliminates duplication between EventHandler and debug/chat.ts
 */
export class LLMServiceManager {
  private static instances = new Map<string, LLMServiceManager>();
  private llmInstances = new Map<string, MultiLLMService>();
  private llmSettings: TenexLLMs;

  private constructor(private projectPath: string) {}

  /**
   * Create or retrieve an LLMServiceManager instance for a project
   */
  static async create(projectPath: string): Promise<LLMService> {
    let manager = LLMServiceManager.instances.get(projectPath);
    if (!manager) {
      manager = new LLMServiceManager(projectPath);
      await manager.initialize();
      LLMServiceManager.instances.set(projectPath, manager);
    }
    return manager.createLLMService();
  }

  /**
   * Clear cached instance for a project (useful for testing)
   */
  static clearInstance(projectPath: string): void {
    LLMServiceManager.instances.delete(projectPath);
  }

  private async initialize(): Promise<void> {
    // Load LLM configuration
    const { llms } = await configService.loadConfig(this.projectPath);
    this.llmSettings = llms;

    if (!llms.configurations || Object.keys(llms.configurations).length === 0) {
      throw new Error("No LLM configurations found");
    }

    // Create MultiLLMService instances for each configuration
    for (const [configName, config] of Object.entries(llms.configurations)) {
      const credentials = llms.credentials[config.provider];
      if (!credentials?.apiKey) {
        logger.error(`Missing API key for provider ${config.provider} in config ${configName}`);
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
      logger.debug(`Initialized LLM instance: ${configName}`, {
        provider: config.provider,
        model: config.model,
      });
    }

    if (this.llmInstances.size === 0) {
      throw new Error("No valid LLM configurations could be initialized");
    }
  }

  /**
   * Create an LLMService that routes to the appropriate instance
   */
  private createLLMService(): LLMService {
    // If there's only one LLM instance, return it directly
    if (this.llmInstances.size === 1) {
      return this.llmInstances.values().next().value;
    }

    // Create a routing LLM service
    return {
      complete: async (request) => {
        const configKey = this.getConfigKey(request);
        const llmInstance = this.llmInstances.get(configKey);
        
        if (!llmInstance) {
          throw new Error(`LLM configuration '${configKey}' not found`);
        }
        
        return llmInstance.complete(request);
      },

      stream: async function* (request) {
        const configKey = this.getConfigKey(request);
        const llmInstance = this.llmInstances.get(configKey);
        
        if (!llmInstance) {
          throw new Error(`LLM configuration '${configKey}' not found`);
        }
        
        yield* llmInstance.stream(request);
      }.bind(this),
    };
  }

  /**
   * Determine which LLM configuration to use based on request context
   */
  private getConfigKey(request: CompletionRequest | string | { _context?: { agent?: { llmConfig?: string } } }): string {
    // Handle string requests (direct config key)
    if (typeof request === "string") {
      return request;
    }

    // Extract config from request context
    // This needs to be passed through the request somehow
    const context = request._context;
    if (context?.agent?.llmConfig) {
      return context.agent.llmConfig;
    }

    // Use defaults
    return (
      this.llmSettings.defaults?.agents ||
      this.llmSettings.defaults?.routing ||
      Object.keys(this.llmInstances)[0] ||
      "default"
    );
  }

  /**
   * Get a specific LLM instance by configuration name
   * Used when we need direct access to a specific configuration
   */
  getInstanceByConfig(configName: string): MultiLLMService | undefined {
    return this.llmInstances.get(configName);
  }

  /**
   * Get the default LLM instance based on settings
   */
  getDefaultInstance(): MultiLLMService {
    const defaultConfigName = 
      this.llmSettings.defaults?.agents ||
      this.llmSettings.defaults?.routing ||
      Object.keys(this.llmInstances)[0];
    
    const instance = this.llmInstances.get(defaultConfigName);
    if (!instance) {
      throw new Error(`Default LLM configuration '${defaultConfigName}' not found`);
    }
    
    return instance;
  }

  /**
   * Create an LLM service with agent context
   * This allows proper routing based on agent's llmConfig
   */
  createAgentAwareLLMService(agent?: Agent): LLMService {
    return {
      complete: async (request) => {
        const configKey = agent?.llmConfig || this.getConfigKey(request);
        const llmInstance = this.llmInstances.get(configKey);
        
        if (!llmInstance) {
          throw new Error(`LLM configuration '${configKey}' not found`);
        }
        
        return llmInstance.complete(request);
      },

      stream: async function* (request) {
        const configKey = agent?.llmConfig || this.getConfigKey(request);
        const llmInstance = this.llmInstances.get(configKey);
        
        if (!llmInstance) {
          throw new Error(`LLM configuration '${configKey}' not found`);
        }
        
        yield* llmInstance.stream(request);
      }.bind(this),
    };
  }
}