import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "@tenex/shared";
import chalk from "chalk";
import inquirer from "inquirer";
import type { LLMConfig, LLMProvider } from "@tenex/types";
import { OpenAIProvider } from "./agents/llm/OpenAIProvider.js";
import { AnthropicProvider } from "./agents/llm/AnthropicProvider.js";
import { OpenRouterProvider } from "./agents/llm/OpenRouterProvider.js";

interface DaemonConfig {
    whitelistedPubkeys: string[];
    llms: LLMConfig[];
}

export async function runInteractiveSetup(): Promise<DaemonConfig> {
    console.log(chalk.cyan("\n🚀 Welcome to TENEX Daemon Setup\n"));
    console.log("Let's configure your daemon to get started.\n");

    // Step 1: Get whitelisted pubkeys
    const pubkeys = await promptForPubkeys();

    // Step 2: Configure LLMs
    const llms = await configureLLMs();

    const config: DaemonConfig = {
        whitelistedPubkeys: pubkeys,
        llms,
    };

    // Step 3: Save configuration
    await saveConfiguration(config);

    return config;
}

async function promptForPubkeys(): Promise<string[]> {
    console.log(chalk.yellow("Step 1: Whitelist Configuration"));
    console.log("Enter the Nostr pubkeys (hex format) that are allowed to control this daemon.");
    console.log("You can add multiple pubkeys, one at a time.\n");

    const pubkeys: string[] = [];
    let addMore = true;

    while (addMore) {
        const { pubkey } = await inquirer.prompt([
            {
                type: "input",
                name: "pubkey",
                message: "Enter a pubkey (hex format):",
                validate: (input) => {
                    if (!input.trim()) {
                        return "Pubkey cannot be empty";
                    }
                    if (!/^[a-f0-9]{64}$/i.test(input.trim())) {
                        return "Invalid pubkey format. Must be 64 hex characters";
                    }
                    return true;
                },
            },
        ]);

        pubkeys.push(pubkey.trim().toLowerCase());

        if (pubkeys.length > 0) {
            const { continueAdding } = await inquirer.prompt([
                {
                    type: "confirm",
                    name: "continueAdding",
                    message: "Add another pubkey?",
                    default: false,
                },
            ]);
            addMore = continueAdding;
        }
    }

    console.log(chalk.green(`\n✓ Added ${pubkeys.length} whitelisted pubkey(s)\n`));
    return pubkeys;
}

async function configureLLMs(): Promise<LLMConfig[]> {
    console.log(chalk.yellow("Step 2: LLM Configuration"));
    console.log("Configure the Large Language Models (LLMs) for your agents.\n");

    const llms: LLMConfig[] = [];
    let addMore = true;

    while (addMore) {
        const llmConfig = await configureSingleLLM();
        if (llmConfig) {
            llms.push(llmConfig);
        }

        const { continueAdding } = await inquirer.prompt([
            {
                type: "confirm",
                name: "continueAdding",
                message: "Add another LLM configuration?",
                default: llms.length === 0,
            },
        ]);
        addMore = continueAdding;
    }

    if (llms.length === 0) {
        console.log(chalk.yellow("\n⚠️  No LLM configurations added. Projects won't have default LLM settings."));
    } else {
        console.log(chalk.green(`\n✓ Added ${llms.length} LLM configuration(s)\n`));
    }

    return llms;
}

async function configureSingleLLM(): Promise<LLMConfig | null> {
    const { provider } = await inquirer.prompt([
        {
            type: "list",
            name: "provider",
            message: "Select LLM provider:",
            choices: [
                { name: "OpenAI", value: "openai" },
                { name: "Anthropic (Claude)", value: "anthropic" },
                { name: "OpenRouter", value: "openrouter" },
            ],
        },
    ]);

    let model: string;
    let apiKey: string;

    switch (provider) {
        case "openai": {
            const answers = await inquirer.prompt([
                {
                    type: "list",
                    name: "model",
                    message: "Select OpenAI model:",
                    choices: [
                        { name: "GPT-4o", value: "gpt-4o" },
                        { name: "GPT-4 Turbo", value: "gpt-4-turbo" },
                        { name: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" },
                        { name: "Other (enter manually)", value: "other" },
                    ],
                },
                {
                    type: "input",
                    name: "customModel",
                    message: "Enter model name:",
                    when: (answers) => answers.model === "other",
                },
                {
                    type: "password",
                    name: "apiKey",
                    message: "Enter OpenAI API key:",
                    validate: (input) => input.trim() !== "" || "API key cannot be empty",
                },
            ]);
            model = answers.model === "other" ? answers.customModel : answers.model;
            apiKey = answers.apiKey;
            break;
        }

        case "anthropic": {
            const answers = await inquirer.prompt([
                {
                    type: "list",
                    name: "model",
                    message: "Select Anthropic model:",
                    choices: [
                        { name: "Claude 3 Opus", value: "claude-3-opus-20240229" },
                        { name: "Claude 3.5 Sonnet", value: "claude-3-5-sonnet-20241022" },
                        { name: "Claude 3 Haiku", value: "claude-3-haiku-20240307" },
                        { name: "Other (enter manually)", value: "other" },
                    ],
                },
                {
                    type: "input",
                    name: "customModel",
                    message: "Enter model name:",
                    when: (answers) => answers.model === "other",
                },
                {
                    type: "password",
                    name: "apiKey",
                    message: "Enter Anthropic API key:",
                    validate: (input) => input.trim() !== "" || "API key cannot be empty",
                },
            ]);
            model = answers.model === "other" ? answers.customModel : answers.model;
            apiKey = answers.apiKey;
            break;
        }

        case "openrouter": {
            const answers = await inquirer.prompt([
                {
                    type: "input",
                    name: "model",
                    message: "Enter OpenRouter model name (e.g., anthropic/claude-3-opus):",
                    validate: (input) => input.trim() !== "" || "Model name cannot be empty",
                },
                {
                    type: "password",
                    name: "apiKey",
                    message: "Enter OpenRouter API key:",
                    validate: (input) => input.trim() !== "" || "API key cannot be empty",
                },
            ]);
            model = answers.model;
            apiKey = answers.apiKey;
            break;
        }

        default:
            return null;
    }

    const { enableCaching } = await inquirer.prompt([
        {
            type: "confirm",
            name: "enableCaching",
            message: "Enable prompt caching? (reduces costs for supported models)",
            default: true,
        },
    ]);

    // Test the configuration
    const { testConfig } = await inquirer.prompt([
        {
            type: "confirm",
            name: "testConfig",
            message: "Test this LLM configuration?",
            default: true,
        },
    ]);

    if (testConfig) {
        const success = await testLLMConfig({ provider, model, apiKey, enableCaching });
        if (!success) {
            const { keepConfig } = await inquirer.prompt([
                {
                    type: "confirm",
                    name: "keepConfig",
                    message: "Test failed. Keep this configuration anyway?",
                    default: false,
                },
            ]);
            if (!keepConfig) {
                return null;
            }
        }
    }

    return {
        provider: provider as LLMProvider,
        model,
        apiKey,
        enableCaching,
    };
}

async function testLLMConfig(config: LLMConfig): Promise<boolean> {
    console.log(chalk.cyan("\n🧪 Testing LLM configuration..."));

    try {
        let provider;
        switch (config.provider) {
            case "openai":
                provider = new OpenAIProvider(config);
                break;
            case "anthropic":
                provider = new AnthropicProvider(config);
                break;
            case "openrouter":
                provider = new OpenRouterProvider(config);
                break;
            default:
                throw new Error(`Unknown provider: ${config.provider}`);
        }

        const response = await provider.generateResponse(
            [
                {
                    role: "user",
                    content: "Say 'Hello from TENEX!' if you can hear me.",
                },
            ],
            config
        );

        if (response.content.toLowerCase().includes("hello from tenex")) {
            console.log(chalk.green("✓ LLM configuration test successful!"));
            console.log(chalk.gray(`Response: ${response.content}`));
            return true;
        } else {
            console.log(chalk.red("✗ Unexpected response from LLM"));
            return false;
        }
    } catch (error) {
        console.log(chalk.red(`✗ LLM test failed: ${error.message}`));
        return false;
    }
}

async function saveConfiguration(config: DaemonConfig): Promise<void> {
    const defaultPath = path.join(process.env.HOME || "", ".tenex", "daemon.json");

    const { savePath } = await inquirer.prompt([
        {
            type: "input",
            name: "savePath",
            message: "Where should the configuration be saved?",
            default: defaultPath,
        },
    ]);

    try {
        const dir = path.dirname(savePath);
        await fs.mkdir(dir, { recursive: true });
        
        await fs.writeFile(savePath, JSON.stringify(config, null, 2), "utf-8");
        
        console.log(chalk.green(`\n✓ Configuration saved to: ${savePath}`));
        console.log(chalk.gray("\nYou can now run 'tenex daemon' to start the daemon with your configuration."));
    } catch (error) {
        logger.error("Failed to save configuration", { error });
        throw error;
    }
}