import os from "node:os";
import path from "node:path";
import { createLLMService } from "@/core/llm/LLMServiceFactory";
import type { CompletionRequest } from "@/core/llm/types";
import search from "@inquirer/search";
import * as fileSystem from "@tenex/shared/fs";
import { logger } from "@tenex/shared/node";
import { configurationService } from "@tenex/shared/services";
import type { UnifiedLLMConfig, LLMCredentials, LLMSettings, LLMPreset, ProviderAuth } from "@tenex/types/config";
import type { LLMConfig, LLMProvider } from "@tenex/types/llm";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";

type LLMConfigWithName = LLMConfig & {
  name: string;
};

interface ProviderModels {
  [key: string]: string[];
}

interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

interface OllamaModelsResponse {
  models: OllamaModel[];
}

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing: {
    prompt: string;
    completion: string;
    request?: string;
    image?: string;
    web_search?: string;
    internal_reasoning?: string;
    input_cache_read?: string;
    input_cache_write?: string;
  };
  context_length: number;
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens?: number;
  };
  input_modalities?: string[];
  output_modalities?: string[];
}

interface OpenRouterModelWithMetadata {
  id: string;
  name: string;
  supportsCaching: boolean;
  promptPrice: number;
  completionPrice: number;
  cacheReadPrice?: number;
  cacheWritePrice?: number;
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

const PROVIDER_MODELS: ProviderModels = {
  anthropic: [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
  ],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
  openrouter: [], // Will be populated dynamically
  google: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
  groq: ["llama-3.1-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
  deepseek: ["deepseek-chat", "deepseek-coder"],
  ollama: [], // Will be populated dynamically
};

async function fetchOllamaModels(): Promise<string[]> {
  try {
    const response = await fetch("http://localhost:11434/api/tags");
    if (!response.ok) {
      throw new Error(`Ollama API returned ${response.status}`);
    }

    const data = (await response.json()) as OllamaModelsResponse;
    return data.models.map((model) => model.name);
  } catch (error) {
    logger.warn(`Could not fetch Ollama models: ${error}`);
    logger.info("Make sure Ollama is running with: ollama serve");

    // Return fallback models if Ollama is not available
    return ["llama3.2", "llama3.1", "codellama", "mistral", "gemma2", "qwen2.5"];
  }
}

// fetchOpenRouterModels is no longer needed - we use fetchOpenRouterModelsWithMetadata directly

async function fetchOpenRouterModelsWithMetadata(): Promise<OpenRouterModelWithMetadata[]> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        "HTTP-Referer": "https://tenex.dev",
        "X-Title": "TENEX CLI",
      },
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API returned ${response.status}`);
    }

    const data = (await response.json()) as OpenRouterModelsResponse;
    return data.data
      .filter((model) => {
        // Check if model supports text input and output
        const hasTextInput = model.input_modalities?.includes("text") ?? true;
        const hasTextOutput = model.output_modalities?.includes("text") ?? true;
        return hasTextInput && hasTextOutput;
      })
      .map((model) => ({
        id: model.id,
        name: model.name,
        supportsCaching: !!(model.pricing.input_cache_read && model.pricing.input_cache_write),
        promptPrice: Number.parseFloat(model.pricing.prompt) * 1000000, // Convert to price per 1M tokens
        completionPrice: Number.parseFloat(model.pricing.completion) * 1000000,
        cacheReadPrice: model.pricing.input_cache_read
          ? Number.parseFloat(model.pricing.input_cache_read) * 1000000
          : undefined,
        cacheWritePrice: model.pricing.input_cache_write
          ? Number.parseFloat(model.pricing.input_cache_write) * 1000000
          : undefined,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    logger.warn(`Could not fetch OpenRouter models: ${error}`);
    // Return common OpenRouter models as fallback
    return [
      {
        id: "anthropic/claude-3.5-sonnet",
        name: "Claude 3.5 Sonnet",
        supportsCaching: true,
        promptPrice: 3,
        completionPrice: 15,
      },
      {
        id: "openai/gpt-4o",
        name: "GPT-4o",
        supportsCaching: false,
        promptPrice: 5,
        completionPrice: 15,
      },
    ];
  }
}

async function selectModelWithSearch(provider: string, models: string[]): Promise<string> {
  const formattedModels = models.map((model) => ({
    name: model,
    value: model,
  }));

  return search({
    message: `Select ${provider} model:`,
    source: async (input) => {
      if (!input) {
        return formattedModels;
      }

      const filtered = formattedModels.filter((model) =>
        model.name.toLowerCase().includes(input.toLowerCase())
      );

      return filtered.length > 0 ? filtered : formattedModels;
    },
  });
}

async function selectOpenRouterModelWithPricing(
  models: OpenRouterModelWithMetadata[]
): Promise<{ model: string; supportsCaching: boolean }> {
  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}/1M`;
  };

  const formatModelChoice = (model: OpenRouterModelWithMetadata) => {
    const cachingIndicator = model.supportsCaching ? " 📦" : "";
    const pricing = `${formatPrice(model.promptPrice)} in / ${formatPrice(
      model.completionPrice
    )} out`;

    return {
      name: `${model.id}${cachingIndicator} - ${pricing}`,
      value: model.id,
      short: model.id,
    };
  };

  const formattedModels = models.map(formatModelChoice);

  const model = await search({
    message: "Select OpenRouter model (📦 = supports caching):",
    source: async (input) => {
      if (!input) {
        return formattedModels;
      }

      const filtered = formattedModels.filter((model) =>
        model.value.toLowerCase().includes(input.toLowerCase())
      );

      return filtered.length > 0 ? filtered : formattedModels;
    },
  });

  const selectedModel = models.find((m) => m.id === model);
  return {
    model,
    supportsCaching: selectedModel?.supportsCaching || false,
  };
}

export const llmCommand = new Command("llm")
  .description("Manage LLM configurations (global by default, --project for current project)")
  .option("--project", "Use project-specific configuration instead of global")
  .action(async (options) => {
    try {
      let configPath: string;
      let isGlobal: boolean;

      if (options.project) {
        // Project-specific configuration
        const projectPath = process.cwd();

        // Check if we're in a TENEX project
        if (!(await fileSystem.directoryExists(path.join(projectPath, ".tenex")))) {
          logger.error("No .tenex directory found. Make sure you're in a TENEX project directory.");
          process.exit(1);
        }

        configPath = projectPath;
        isGlobal = false;
      } else {
        // Global configuration
        const globalConfigDir = path.join(os.homedir(), ".tenex");

        // Ensure global config directory exists
        try {
          await fileSystem.ensureDirectory(globalConfigDir);
        } catch (error) {
          logger.error(`Failed to create global config directory: ${error}`);
          process.exit(1);
        }

        configPath = "";
        isGlobal = true;
      }

      const llmManager = new LLMConfigEditor(configPath, isGlobal);
      await llmManager.showMainMenu();
    } catch (error) {
      logger.error(`Failed to start LLM configuration: ${error}`);
      process.exit(1);
    }
  });

export class LLMConfigEditor {
  private configPath: string;
  private isGlobal: boolean;

  constructor(configPath: string, isGlobal = true) {
    this.configPath = configPath;
    this.isGlobal = isGlobal;
  }

  async showMainMenu(): Promise<void> {
    const llmsConfig = await this.loadConfig();
    const configs = this.getConfigList(llmsConfig);

    logger.info(
      chalk.cyan(`\n🤖 LLM Configuration Manager (${this.isGlobal ? "global" : "project"})\n`)
    );

    if (configs.length > 0) {
      logger.info(chalk.green("Current configurations:"));
      configs.forEach((config, index) => {
        const isDefault = llmsConfig.defaults.agents === config.name;
        const defaultIndicator = isDefault ? chalk.yellow(" (default)") : "";
        logger.info(`  ${index + 1}. ${chalk.bold(config.name)}${defaultIndicator}`);
        const llmConfig = llmsConfig.configurations[config.name];
        if (llmConfig) {
          logger.info(`     ${llmConfig.provider} - ${llmConfig.model}`);
        }
      });
      logger.info("");
    }

    const currentDefault = llmsConfig.defaults.agents || "none";
    const currentAgentRouting = llmsConfig.defaults.agentRouting || "none";

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "What would you like to do?",
        choices: [
          { name: "Add new LLM configuration", value: "add" },
          ...(configs.length > 0
            ? [
                { name: "Test existing configuration", value: "test" },
                { name: "Edit existing configuration", value: "edit" },
                { name: "Remove configuration", value: "remove" },
                { name: `Set agent's default [${currentDefault}]`, value: "default" },
                {
                  name: `Set agent routing model [${currentAgentRouting}]`,
                  value: "agentrouting",
                },
              ]
            : []),
          { name: "Exit", value: "exit" },
        ],
      },
    ]);

    switch (action) {
      case "add":
        await this.addConfiguration(llmsConfig);
        break;
      case "test":
        await this.testExistingConfiguration(llmsConfig);
        break;
      case "edit":
        await this.editConfiguration(llmsConfig);
        break;
      case "remove":
        await this.removeConfiguration(llmsConfig);
        break;
      case "default":
        await this.setDefaultConfiguration(llmsConfig);
        break;
      case "agentrouting":
        await this.setAgentRoutingConfiguration(llmsConfig);
        break;
      case "exit":
        logger.info(chalk.green("\n✅ Configuration saved!"));
        return;
    }

    // Show menu again after action
    await this.showMainMenu();
  }

  async runOnboardingFlow(): Promise<void> {
    logger.info(chalk.cyan("\n🤖 LLM Configuration Setup\n"));

    let hasAddedConfig = false;

    while (true) {
      const llmsConfig = await this.loadConfig();
      const configs = this.getConfigList(llmsConfig);

      if (configs.length > 0) {
        logger.info(chalk.green("Current configurations:"));
        configs.forEach((config, index) => {
          const isDefault = llmsConfig.defaults.agents === config.name;
          const defaultIndicator = isDefault ? chalk.yellow(" (default)") : "";
          logger.info(`  ${index + 1}. ${chalk.bold(config.name)}${defaultIndicator}`);
          const llmConfig = llmsConfig.configurations[config.name];
          if (llmConfig) {
            logger.info(`     ${llmConfig.provider} - ${llmConfig.model}`);
          }
        });
        logger.info("");
      }

      const currentDefault = llmsConfig.defaults.agents || "none";
      const currentAgentRouting = llmsConfig.defaults.agentRouting || "none";

      const choices = [
        { name: "Add new LLM configuration", value: "add" },
        ...(configs.length > 0
          ? [
              { name: "Edit existing configuration", value: "edit" },
              { name: "Remove configuration", value: "remove" },
              { name: `Agent's default: [${currentDefault}]`, value: "default" },
              {
                name: `Agent Routing: [${currentAgentRouting}]`,
                value: "agentrouting",
              },
            ]
          : []),
      ];

      if (hasAddedConfig) {
        choices.push({ name: "Continue with setup", value: "continue" });
      }

      const { action } = await inquirer.prompt([
        {
          type: "list",
          name: "action",
          message: "What would you like to do?",
          choices,
        },
      ]);

      switch (action) {
        case "add":
          await this.addConfiguration(llmsConfig);
          hasAddedConfig = true;
          break;
        case "edit":
          await this.editConfiguration(llmsConfig);
          break;
        case "remove":
          await this.removeConfiguration(llmsConfig);
          break;
        case "default":
          await this.setDefaultConfiguration(llmsConfig);
          break;
        case "agentrouting":
          await this.setAgentRoutingConfiguration(llmsConfig);
          break;
        case "continue":
          logger.info(chalk.green("\n✅ LLM configuration complete!"));
          return;
      }
    }
  }

  private async loadConfig(): Promise<UnifiedLLMConfig> {
    try {
      const configuration = await configurationService.loadConfiguration(
        this.configPath,
        this.isGlobal
      );
      // Convert LLMSettings to UnifiedLLMConfig
      return this.convertToUnifiedLLMConfig(configuration.llms);
    } catch (error) {
      logger.error(`Failed to load LLM configuration: ${error}`);
      return {
        configurations: {},
        defaults: {},
      };
    }
  }

  private async saveConfig(config: UnifiedLLMConfig): Promise<void> {
    const configuration = await configurationService.loadConfiguration(
      this.configPath,
      this.isGlobal
    );
    // Convert UnifiedLLMConfig to LLMSettings
    configuration.llms = this.convertToLLMSettings(config);
    await configurationService.saveConfiguration(this.configPath, configuration, this.isGlobal);
  }

  private getConfigList(llmsConfig: UnifiedLLMConfig): LLMConfigWithName[] {
    const configs: LLMConfigWithName[] = [];

    for (const [key, value] of Object.entries(llmsConfig.configurations)) {
      configs.push({
        name: key,
        ...value,
      });
    }

    return configs;
  }

  private getExistingApiKeys(llmsConfig: UnifiedLLMConfig, provider: LLMProvider): string[] {
    const keys = new Set<string>();

    for (const config of Object.values(llmsConfig.configurations)) {
      if (config.provider === provider && config.apiKey) {
        keys.add(config.apiKey);
      }
    }

    // Also check credentials if this is global config
    if (this.isGlobal && llmsConfig.credentials?.[provider]?.apiKey) {
      const apiKey = llmsConfig.credentials[provider]?.apiKey;
      if (!apiKey) {
        throw new Error(`API key not found for provider ${provider}`);
      }
      keys.add(apiKey);
    }

    return Array.from(keys);
  }

  private async addConfiguration(llmsConfig: UnifiedLLMConfig): Promise<void> {
    logger.info(chalk.cyan("\n➕ Add New LLM Configuration\n"));

    const { provider } = await inquirer.prompt([
      {
        type: "list",
        name: "provider",
        message: "Select LLM provider:",
        choices: Object.keys(PROVIDER_MODELS).map((p) => ({
          name: p.charAt(0).toUpperCase() + p.slice(1),
          value: p as LLMProvider,
        })),
      },
    ]);

    let availableModels = PROVIDER_MODELS[provider];
    let model: string;
    let supportsCaching = false;

    // Fetch models dynamically for providers that support it
    if (provider === "ollama") {
      logger.info(chalk.cyan("🔍 Fetching available Ollama models..."));
      availableModels = await fetchOllamaModels();

      if (availableModels.length === 0) {
        logger.info(
          chalk.red(
            "❌ No Ollama models found. Please install models first with 'ollama pull <model>'"
          )
        );
        return;
      }

      logger.info(chalk.green(`✅ Found ${availableModels.length} Ollama models`));
      model = await selectModelWithSearch(provider, availableModels || []);
    } else if (provider === "openrouter") {
      logger.info(chalk.cyan("🔍 Fetching available OpenRouter models..."));
      const modelsWithMetadata = await fetchOpenRouterModelsWithMetadata();
      logger.info(chalk.green(`✅ Found ${modelsWithMetadata.length} OpenRouter models`));

      const selection = await selectOpenRouterModelWithPricing(modelsWithMetadata);
      model = selection.model;
      supportsCaching = selection.supportsCaching;
    } else {
      model = await selectModelWithSearch(provider, availableModels || []);
    }

    let apiKey = "";
    if (provider !== "ollama") {
      const existingKeys = this.getExistingApiKeys(llmsConfig, provider);

      if (existingKeys.length > 0) {
        const { keyChoice } = await inquirer.prompt([
          {
            type: "list",
            name: "keyChoice",
            message: "API Key:",
            choices: [
              ...existingKeys.map((key) => ({
                name: `Reuse existing key: ${key.substring(0, 10)}...`,
                value: key,
              })),
              { name: "Enter new API key", value: "new" },
            ],
          },
        ]);

        if (keyChoice === "new") {
          const { newKey } = await inquirer.prompt([
            {
              type: "password",
              name: "newKey",
              message: "Enter API key:",
              mask: "*",
            },
          ]);
          apiKey = newKey;
        } else {
          apiKey = keyChoice;
        }
      } else {
        const { newKey } = await inquirer.prompt([
          {
            type: "password",
            name: "newKey",
            message: "Enter API key:",
            mask: "*",
          },
        ]);
        apiKey = newKey;
      }
    }

    // Default configuration name based on provider and model
    const defaultConfigName = `${provider}-${model}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    // Handle caching based on provider
    const cachingPrompts = [];
    if (
      (provider === "anthropic" && model.includes("claude")) ||
      (provider === "openrouter" && supportsCaching)
    ) {
      cachingPrompts.push({
        type: "confirm",
        name: "enableCaching",
        message: "Enable prompt caching? (reduces costs for repeated context)",
        default: true,
      });
    }

    const prompts: Array<Record<string, unknown>> = [
      {
        type: "input",
        name: "configName",
        message: "Configuration name:",
        default: defaultConfigName,
        validate: (input: string) => {
          if (!input.trim()) return "Configuration name is required";
          if (llmsConfig.configurations[input]) return `Configuration "${input}" already exists`;
          return true;
        },
      },
      ...cachingPrompts,
      {
        type: "confirm",
        name: "setAsDefault",
        message: "Set as default configuration?",
        default: Object.keys(llmsConfig.configurations).length === 0,
      },
    ];

    // Type assertion needed due to inquirer's complex prompt type system
    const responses = await inquirer.prompt(prompts as unknown as Parameters<typeof inquirer.prompt>[0]);

    const configName = responses.configName as string;
    const enableCaching =
      "enableCaching" in responses ? (responses.enableCaching as boolean) : supportsCaching;
    const setAsDefault = responses.setAsDefault as boolean;

    const newConfig: LLMConfig = {
      provider,
      model,
      enableCaching,
    };

    // Only add apiKey if it's not empty
    if (apiKey?.trim()) {
      newConfig.apiKey = apiKey;
    }

    // Test the configuration BEFORE saving it
    logger.info(chalk.cyan("\n🧪 Testing configuration before saving..."));

    // For testing, ensure the config has the API key even if it will be stored in credentials
    const testConfig = { ...newConfig };
    if (this.isGlobal && apiKey && provider !== "ollama" && !testConfig.apiKey) {
      testConfig.apiKey = apiKey;
    }

    const testSuccessful = await this.testConfiguration(testConfig, configName);

    if (!testSuccessful) {
      const { retry } = await inquirer.prompt([
        {
          type: "confirm",
          name: "retry",
          message: "Test failed. Would you like to try again with different settings?",
          default: true,
        },
      ]);

      if (retry) {
        logger.info(chalk.yellow("\n🔄 Let's try again..."));
        await this.addConfiguration(llmsConfig);
        return;
      }
      logger.info(chalk.red("\n❌ Configuration not saved due to test failure."));
      return;
    }

    // Only save if test passes
    llmsConfig.configurations[configName] = newConfig;

    if (setAsDefault) {
      llmsConfig.defaults.agents = configName;
    }

    // If this is global config and a new API key was entered, save it to credentials
    if (this.isGlobal && apiKey && provider !== "ollama") {
      if (!llmsConfig.credentials) {
        llmsConfig.credentials = {};
      }
      llmsConfig.credentials[provider] = {
        apiKey,
        baseUrl: provider === "openrouter" ? "https://openrouter.ai/api/v1" : undefined,
      };

      // Remove API key from individual config in global mode
      newConfig.apiKey = undefined;
    }

    await this.saveConfig(llmsConfig);
    logger.info(chalk.green(`\n✅ Configuration "${configName}" added and tested successfully!`));
  }

  private async editConfiguration(llmsConfig: UnifiedLLMConfig): Promise<void> {
    const configs = this.getConfigList(llmsConfig);

    const { configName } = await inquirer.prompt([
      {
        type: "list",
        name: "configName",
        message: "Select configuration to edit:",
        choices: configs.map((c) => c.name),
      },
    ]);

    const config = llmsConfig.configurations[configName];
    if (!config) {
      logger.error(chalk.red(`Configuration ${configName} not found`));
      return;
    }
    logger.info(chalk.cyan(`\n✏️ Editing Configuration: ${configName}\n`));

    const { field } = await inquirer.prompt([
      {
        type: "list",
        name: "field",
        message: "What would you like to edit?",
        choices: [
          { name: "Model", value: "model" },
          { name: "API Key", value: "apiKey" },
          { name: "Enable Caching", value: "enableCaching" },
          { name: "Configuration Name", value: "name" },
        ],
      },
    ]);

    switch (field) {
      case "model": {
        let availableModels = PROVIDER_MODELS[config.provider];
        let newModel: string;
        let newSupportsCaching = false;

        // Fetch models dynamically for editing
        if (config.provider === "ollama") {
          logger.info(chalk.cyan("🔍 Fetching available Ollama models..."));
          availableModels = await fetchOllamaModels();

          if (availableModels.length === 0) {
            logger.info(
              chalk.red(
                "❌ No Ollama models found. Please install models first with 'ollama pull <model>'"
              )
            );
            return;
          }

          logger.info(chalk.green(`✅ Found ${availableModels.length} Ollama models`));
          newModel = await selectModelWithSearch(config.provider, availableModels || []);
        } else if (config.provider === "openrouter") {
          logger.info(chalk.cyan("🔍 Fetching available OpenRouter models..."));
          const modelsWithMetadata = await fetchOpenRouterModelsWithMetadata();
          logger.info(chalk.green(`✅ Found ${modelsWithMetadata.length} OpenRouter models`));

          const selection = await selectOpenRouterModelWithPricing(modelsWithMetadata);
          newModel = selection.model;
          newSupportsCaching = selection.supportsCaching;
        } else {
          newModel = await selectModelWithSearch(config.provider, availableModels || []);
        }

        config.model = newModel;
        if (config.provider === "openrouter") {
          config.enableCaching = newSupportsCaching;
        }
        break;
      }
      case "apiKey": {
        if (config.provider !== "ollama") {
          const { apiKey } = await inquirer.prompt([
            {
              type: "password",
              name: "apiKey",
              message: "Enter new API key:",
              mask: "*",
            },
          ]);
          config.apiKey = apiKey;
        }
        break;
      }
      case "enableCaching": {
        const { enableCaching } = await inquirer.prompt([
          {
            type: "confirm",
            name: "enableCaching",
            message: "Enable prompt caching?",
            default: config.enableCaching,
          },
        ]);
        config.enableCaching = enableCaching;
        break;
      }
      case "name": {
        const { newName } = await inquirer.prompt([
          {
            type: "input",
            name: "newName",
            message: "Enter new configuration name:",
            default: configName,
            validate: (input: string) => {
              if (!input.trim()) return "Configuration name is required";
              if (input !== configName && llmsConfig.configurations[input])
                return `Configuration "${input}" already exists`;
              return true;
            },
          },
        ]);

        if (newName !== configName) {
          llmsConfig.configurations[newName] = config;
          delete llmsConfig.configurations[configName];

          // Update defaults if needed
          for (const [key, value] of Object.entries(llmsConfig.defaults)) {
            if (value === configName) {
              llmsConfig.defaults[key] = newName;
            }
          }
        }
        break;
      }
    }

    await this.saveConfig(llmsConfig);
    logger.info(chalk.green("\n✅ Configuration updated successfully!"));
  }

  private async removeConfiguration(llmsConfig: UnifiedLLMConfig): Promise<void> {
    const configs = this.getConfigList(llmsConfig);

    const { configName } = await inquirer.prompt([
      {
        type: "list",
        name: "configName",
        message: "Select configuration to remove:",
        choices: configs.map((c) => c.name),
      },
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: `Are you sure you want to remove "${configName}"?`,
        default: false,
      },
    ]);

    if (confirm) {
      delete llmsConfig.configurations[configName];

      // Update defaults if needed
      for (const [key, value] of Object.entries(llmsConfig.defaults)) {
        if (value === configName) {
          delete llmsConfig.defaults[key];
        }
      }

      await this.saveConfig(llmsConfig);
      logger.info(chalk.green(`\n✅ Configuration "${configName}" removed!`));
    }
  }

  private async setDefaultConfiguration(llmsConfig: UnifiedLLMConfig): Promise<void> {
    const configs = this.getConfigList(llmsConfig);
    const currentDefault = llmsConfig.defaults.agents || "none";

    logger.info(chalk.cyan("\n⚙️  Set Default Configuration"));
    logger.info(chalk.gray(`Current default: ${currentDefault}\n`));

    const { configName } = await inquirer.prompt([
      {
        type: "list",
        name: "configName",
        message: "Select configuration to set as default:",
        choices: configs.map((c) => ({
          name: c.name === currentDefault ? `${c.name} (current)` : c.name,
          value: c.name,
        })),
      },
    ]);

    llmsConfig.defaults.agents = configName;
    await this.saveConfig(llmsConfig);
    logger.info(chalk.green(`\n✅ Configuration "${configName}" set as default!`));
  }

  private async setAgentRoutingConfiguration(llmsConfig: UnifiedLLMConfig): Promise<void> {
    const configs = this.getConfigList(llmsConfig);
    const currentAgentRouting = llmsConfig.defaults.agentRouting || "none";

    logger.info(chalk.cyan("\n🚦 Set Agent Routing Configuration"));
    logger.info(chalk.gray(`Current agent routing model: ${currentAgentRouting}\n`));

    const { configName } = await inquirer.prompt([
      {
        type: "list",
        name: "configName",
        message: "Select configuration for agent routing:",
        choices: configs.map((c) => ({
          name: c.name === currentAgentRouting ? `${c.name} (current)` : c.name,
          value: c.name,
        })),
      },
    ]);

    llmsConfig.defaults.agentRouting = configName;
    await this.saveConfig(llmsConfig);
    logger.info(chalk.green(`\n✅ Configuration "${configName}" set for agent routing!`));
  }

  private async testExistingConfiguration(llmsConfig: UnifiedLLMConfig): Promise<void> {
    const configs = this.getConfigList(llmsConfig);

    const { configName } = await inquirer.prompt([
      {
        type: "list",
        name: "configName",
        message: "Select configuration to test:",
        choices: configs.map((c) => c.name),
      },
    ]);

    const config = llmsConfig.configurations[configName];
    if (!config) {
      logger.error(chalk.red(`Configuration ${configName} not found`));
      return;
    }
    await this.testConfiguration(config, configName);
  }

  private async testConfiguration(config: LLMConfig, _configName?: string): Promise<boolean> {
    try {
      // Validate config before testing
      if (!config.provider) {
        logger.error(chalk.red("\n❌ Test failed: Provider is required"));
        return false;
      }

      if (!config.model) {
        logger.error(chalk.red("\n❌ Test failed: Model is required"));
        return false;
      }

      // Check if API key is required for this provider
      if (config.provider !== "ollama" && !config.apiKey) {
        logger.error(chalk.red(`\n❌ Test failed: API key is required for ${config.provider}`));
        return false;
      }

      const service = createLLMService({
        provider: config.provider as
          | "anthropic"
          | "openai"
          | "google"
          | "ollama"
          | "mistral"
          | "groq"
          | "openrouter",
        model: config.model,
        apiKey: config.apiKey,
        baseUrl: config.baseURL,
      });

      const request: CompletionRequest = {
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. Respond with exactly: 'Configuration test successful!'",
          },
          {
            role: "user",
            content: "Please confirm this configuration works.",
          },
        ],
      };

      const response = await service.complete(request);

      if (response?.content) {
        logger.info(chalk.green(`\n✅ Test successful! Response: ${response.content}`));
        return true;
      }

      logger.error(chalk.red("\n❌ Test failed: No response received"));
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(chalk.red(`\n❌ Test failed: ${errorMessage}`));

      // Provide more specific guidance based on error
      if (errorMessage.includes("apiKey") || errorMessage.includes("API key")) {
        logger.info(chalk.yellow("💡 Make sure you've entered a valid API key"));
      } else if (errorMessage.includes("model")) {
        logger.info(chalk.yellow("💡 The selected model might not be available"));
      } else if (errorMessage.includes("network") || errorMessage.includes("connect")) {
        logger.info(chalk.yellow("💡 Check your internet connection"));
      }

      return false;
    }
  }

  private convertToUnifiedLLMConfig(settings: LLMSettings): UnifiedLLMConfig {
    // Convert from LLMSettings to UnifiedLLMConfig
    const configurations: { [name: string]: LLMConfig } = {};
    
    // Convert presets to configurations
    for (const [name, preset] of Object.entries(settings.presets)) {
      configurations[name] = preset;
    }
    
    // Convert selection to defaults
    const defaults: UnifiedLLMConfig['defaults'] = {};
    for (const [purpose, presetName] of Object.entries(settings.selection)) {
      if (purpose === 'default') {
        defaults.agents = presetName;
      } else if (purpose === 'teamBuilding') {
        // Map old teamBuilding to new agentRouting
        defaults.agentRouting = presetName;
      } else {
        defaults[purpose] = presetName;
      }
    }
    
    // Convert auth to credentials
    const credentials: { [provider: string]: LLMCredentials } = {};
    for (const [provider, auth] of Object.entries(settings.auth)) {
      credentials[provider] = auth;
    }
    
    return {
      configurations,
      defaults,
      credentials
    };
  }
  
  private convertToLLMSettings(config: UnifiedLLMConfig): LLMSettings {
    // Convert from UnifiedLLMConfig to LLMSettings
    const presets: Record<string, LLMPreset> = {};
    
    // Convert configurations to presets
    for (const [name, llmConfig] of Object.entries(config.configurations)) {
      presets[name] = llmConfig;
    }
    
    // Convert defaults to selection
    const selection: Record<string, string> = {};
    for (const [key, value] of Object.entries(config.defaults)) {
      if (value && key === 'agents') {
        selection.default = value;
      } else if (value && key === 'agentRouting') {
        // Map new agentRouting to old teamBuilding for backward compatibility
        selection.teamBuilding = value;
      } else if (value) {
        selection[key] = value;
      }
    }
    
    // Convert credentials to auth
    const auth: Record<string, ProviderAuth> = {};
    if (config.credentials) {
      for (const [provider, creds] of Object.entries(config.credentials)) {
        auth[provider] = creds;
      }
    }
    
    return {
      presets,
      selection,
      auth
    };
  }
}