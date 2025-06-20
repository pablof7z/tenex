import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LLMConfigEditor } from "@/commands/setup/llm";
import { logger } from "@tenex/shared";
import type { LLMConfig } from "@tenex/types";
import chalk from "chalk";
import inquirer from "inquirer";

interface DaemonConfig {
  whitelistedPubkeys: string[];
  llms: LLMConfig[];
}

export async function runInteractiveSetup(): Promise<DaemonConfig> {
  logger.info(chalk.cyan("\n🚀 Welcome to TENEX Daemon Setup\n"));
  logger.info("Let's configure your daemon to get started.\n");

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
  logger.info(chalk.yellow("Step 1: Whitelist Configuration"));
  logger.info("Enter the Nostr pubkeys (hex format) that are allowed to control this daemon.");
  logger.info("You can add multiple pubkeys, one at a time.\n");

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

  logger.info(chalk.green(`\n✓ Added ${pubkeys.length} whitelisted pubkey(s)\n`));
  return pubkeys;
}

async function configureLLMs(): Promise<LLMConfig[]> {
  logger.info(chalk.yellow("Step 2: LLM Configuration"));
  logger.info("Configure the Large Language Models (LLMs) for your agents.");
  logger.info("This will use the same configuration system as 'tenex setup llm'.\n");

  // Use the global LLM configuration system
  const globalConfigDir = path.join(os.homedir(), ".tenex");

  // Ensure global config directory exists
  try {
    await fs.mkdir(globalConfigDir, { recursive: true });
  } catch (error) {
    logger.error(`Failed to create global config directory: ${error}`);
    throw error;
  }

  const llmManager = new LLMConfigEditor(globalConfigDir, true);
  await llmManager.runOnboardingFlow();

  // Load the configurations that were just set up
  const globalConfigPath = path.join(globalConfigDir, "config.json");
  try {
    const globalConfig = await fs.readFile(globalConfigPath, "utf-8");
    const config = JSON.parse(globalConfig);
    const llmsConfig: LLMConfigs = config.llms || {};

    // Convert to LLMConfig array
    const llms: LLMConfig[] = [];
    for (const [key, value] of Object.entries(llmsConfig)) {
      if (key !== "default" && typeof value === "object") {
        llms.push(value as LLMConfig);
      }
    }

    if (llms.length === 0) {
      logger.info(
        chalk.yellow("\n⚠️  No LLM configurations found. Projects won't have default LLM settings.")
      );
    } else {
      logger.info(
        chalk.green(`\n✓ Using ${llms.length} LLM configuration(s) from global config\n`)
      );
    }

    return llms;
  } catch (error) {
    logger.warn("Failed to load LLM configurations from global config", { error });
    return [];
  }
}

async function saveConfiguration(config: DaemonConfig): Promise<void> {
  const savePath = path.join(os.homedir(), ".tenex", "config.json");

  try {
    const dir = path.dirname(savePath);
    await fs.mkdir(dir, { recursive: true });

    // Load existing config if it exists
    let existingConfig: Record<string, unknown> = {};
    try {
      const existingContent = await fs.readFile(savePath, "utf-8");
      existingConfig = JSON.parse(existingContent);
    } catch {
      // File doesn't exist, use empty config
    }

    // Update with daemon config (but LLMs are already saved via LLMConfigEditor)
    existingConfig.whitelistedPubkeys = config.whitelistedPubkeys;

    await fs.writeFile(savePath, JSON.stringify(existingConfig, null, 2), "utf-8");

    logger.info(chalk.green(`\n✓ Configuration saved to: ${savePath}`));
    logger.info(
      chalk.gray("\nYou can now run 'tenex daemon' to start the daemon with your configuration.")
    );
  } catch (error) {
    logger.error("Failed to save configuration", { error });
    throw error;
  }
}
