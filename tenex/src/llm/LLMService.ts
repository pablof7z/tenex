import { type Message, type Model, igniteEngine } from "multi-llm-ts";
// Engine type is not exported from multi-llm-ts, define it locally
type Engine = any;
import crypto from "node:crypto";
import { logger } from "@tenex/shared";
import type { LLMConfigManager } from "./ConfigManager";
import type { LLMConfig, LLMMetadata, LLMResponse, LLMStreamChunk } from "./types";

export class LLMService {
  private engines: Map<string, Engine> = new Map();
  private models: Map<string, Model> = new Map();
  private configManager: LLMConfigManager;

  constructor(configManager: LLMConfigManager) {
    this.configManager = configManager;
  }

  private async getEngine(provider: string): Promise<Engine> {
    if (!this.engines.has(provider)) {
      const credentials = this.configManager.getCredentials(provider);

      const engineConfig: any = {
        apiKey: credentials.apiKey,
      };

      // Add baseURL for providers that need it
      if (credentials.baseUrl) {
        engineConfig.baseURL = credentials.baseUrl;
      }

      const engine = igniteEngine(provider, engineConfig);
      this.engines.set(provider, engine);
    }

    return this.engines.get(provider)!;
  }

  private async getModel(configName: string): Promise<{ engine: Engine; model: Model }> {
    // Resolve default configuration if needed
    const resolvedConfigName = this.resolveConfigName(configName);

    if (!this.models.has(resolvedConfigName)) {
      const config = this.configManager.getConfig(resolvedConfigName);
      const engine = await this.getEngine(config.provider);

      // For OpenRouter, we need to create a model object
      const model: Model = {
        id: config.model,
        name: config.model,
        capabilities: {
          reasoning: false,
          vision: false,
          functionCalling: false,
          streaming: true,
        },
      } as Model;

      this.models.set(resolvedConfigName, model);
    }

    const config = this.configManager.getConfig(resolvedConfigName);
    const engine = await this.getEngine(config.provider);
    const model = this.models.get(resolvedConfigName)!;

    return { engine, model };
  }

  async complete(configName: string, messages: Message[]): Promise<LLMResponse> {
    const startTime = Date.now();
    // Resolve default configuration if needed
    const resolvedConfigName = this.resolveConfigName(configName);
    const { engine, model } = await this.getModel(resolvedConfigName);
    const config = this.configManager.getConfig(resolvedConfigName);

    try {
      logger.debug("LLM completion request", { configName, model: config.model });

      const options: any = {};
      if (config.temperature !== undefined) {
        options.temperature = config.temperature;
      }
      if (config.maxTokens !== undefined) {
        options.max_tokens = config.maxTokens;
      }

      const response = await engine.complete(model, messages, options);

      const duration = Date.now() - startTime;
      logger.info("LLM completion successful", {
        configName,
        model: config.model,
        duration,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
      });

      return {
        content: response.content || "",
        model: config.model,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        cost: response.cost,
      };
    } catch (error) {
      logger.error("LLM completion failed", { error, configName, model: config.model });
      throw error;
    }
  }

  async *stream(configName: string, messages: Message[]): AsyncGenerator<LLMStreamChunk> {
    // Resolve default configuration if needed
    const resolvedConfigName = this.resolveConfigName(configName);
    const { engine, model } = await this.getModel(resolvedConfigName);
    const config = this.configManager.getConfig(resolvedConfigName);

    try {
      logger.debug("LLM stream request", { configName, model: config.model });

      const options: any = {};
      if (config.temperature !== undefined) {
        options.temperature = config.temperature;
      }
      if (config.maxTokens !== undefined) {
        options.max_tokens = config.maxTokens;
      }

      const { stream } = await engine.stream(model, messages, options);

      for await (const chunk of stream) {
        if (chunk.type === "content" && chunk.text) {
          yield { type: "content", text: chunk.text };
        } else if (chunk.type === "error") {
          yield { type: "error", error: chunk.error?.message || "Unknown error" };
        }
      }

      yield { type: "done" };
    } catch (error) {
      logger.error("LLM stream failed", { error, configName, model: config.model });
      yield { type: "error", error: String(error) };
    }
  }

  buildMetadata(response: LLMResponse, systemPrompt: string, userPrompt: string): LLMMetadata {
    return {
      model: response.model,
      cost: response.cost || 0,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      totalTokens: response.usage.totalTokens,
      systemPrompt: this.hashPrompt(systemPrompt),
      userPrompt: this.hashPrompt(userPrompt),
    };
  }

  private resolveConfigName(configName: string): string {
    // If configName is 'default' or empty, resolve it using the config manager
    if (!configName || configName === "default") {
      return this.configManager.getDefaultConfig("default");
    }
    return configName;
  }

  private hashPrompt(prompt: string): string {
    return crypto.createHash("sha256").update(prompt).digest("hex").substring(0, 16);
  }
}
