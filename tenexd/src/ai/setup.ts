import chalk from "chalk";
import type { ConfigManager } from "../config/config.js";
import { AIService } from "./service.js";
import type { AIConfiguration, AIProvider } from "./types.js";

export async function setupAIConfiguration(
	configManager: ConfigManager,
): Promise<void> {
	console.log(chalk.cyan("\n🤖 AI Configuration Setup\n"));

	const config = await configManager.getConfig();
	const configurations = config.aiConfigurations || [];

	if (configurations.length === 0) {
		console.log(
			chalk.yellow("AI configuration is required. Let's set one up!\n"),
		);
		await addNewConfiguration(configManager);

		// After first config, ask if they want to add more
		const updatedConfig = await configManager.getConfig();
		if (
			updatedConfig.aiConfigurations &&
			updatedConfig.aiConfigurations.length > 0
		) {
			console.log(
				chalk.yellow("\nWould you like to add another configuration? (y/n)"),
			);
			process.stdout.write(chalk.cyan("> "));

			for await (const line of console) {
				const input = line.trim().toLowerCase();

				if (input === "y" || input === "yes") {
					await addNewConfiguration(configManager);
				}
				break;
			}
		}
	} else {
		console.log(
			chalk.green(`Found ${configurations.length} AI configuration(s):`),
		);
		configurations.forEach((aiConfig, index) => {
			const isDefault = aiConfig.name === config.defaultAIConfiguration;
			console.log(
				chalk.gray(
					`  ${index + 1}. ${aiConfig.name}${isDefault ? " (default)" : ""}`,
				),
			);
		});
		console.log();

		console.log(
			chalk.yellow("Would you like to add another configuration? (y/n)"),
		);
		process.stdout.write(chalk.cyan("> "));

		for await (const line of console) {
			const input = line.trim().toLowerCase();

			if (input === "y" || input === "yes") {
				await addNewConfiguration(configManager);
			}
			break;
		}
	}
}

async function addNewConfiguration(
	configManager: ConfigManager,
): Promise<void> {
	console.log(chalk.cyan("\n📝 Adding new AI configuration\n"));

	// Configuration name
	console.log(
		chalk.yellow(
			"Enter a name for this configuration (e.g., 'default', 'fast', 'smart'):",
		),
	);
	process.stdout.write(chalk.cyan("> "));

	let name = "";
	for await (const line of console) {
		name = line.trim();
		if (name) break;
		console.log(chalk.red("Name cannot be empty. Please enter a name:"));
		process.stdout.write(chalk.cyan("> "));
	}

	// Provider selection
	console.log(chalk.yellow("\nSelect provider:"));
	console.log(chalk.gray("  1. OpenAI"));
	console.log(chalk.gray("  2. OpenRouter"));
	process.stdout.write(chalk.cyan("> "));

	let provider: AIProvider = "openai";
	for await (const line of console) {
		const choice = line.trim();
		if (choice === "1") {
			provider = "openai";
			break;
		}
		if (choice === "2") {
			provider = "openrouter";
			break;
		}
		console.log(chalk.red("Please enter 1 or 2:"));
		process.stdout.write(chalk.cyan("> "));
	}

	// API Key
	console.log(
		chalk.yellow(
			`\nEnter your ${provider === "openai" ? "OpenAI" : "OpenRouter"} API key:`,
		),
	);
	if (provider === "openai") {
		console.log(
			chalk.gray("Get your API key from: https://platform.openai.com/api-keys"),
		);
	} else {
		console.log(
			chalk.gray("Get your API key from: https://openrouter.ai/keys"),
		);
	}
	process.stdout.write(chalk.cyan("> "));

	let apiKey = "";
	for await (const line of console) {
		apiKey = line.trim();
		if (apiKey) break;
		console.log(
			chalk.red("API key cannot be empty. Please enter your API key:"),
		);
		process.stdout.write(chalk.cyan("> "));
	}

	// Model selection
	let model = "";
	if (provider === "openai") {
		console.log(chalk.yellow("\nSelect OpenAI model:"));
		console.log(chalk.gray("  1. gpt-4o (Recommended - Fast and smart)"));
		console.log(chalk.gray("  2. gpt-4o-mini (Faster and cheaper)"));
		console.log(chalk.gray("  3. gpt-4-turbo (Most capable)"));
		console.log(chalk.gray("  4. Custom (Enter model name)"));
		process.stdout.write(chalk.cyan("> "));

		for await (const line of console) {
			const choice = line.trim();
			if (choice === "1") {
				model = "gpt-4o";
				break;
			}
			if (choice === "2") {
				model = "gpt-4o-mini";
				break;
			}
			if (choice === "3") {
				model = "gpt-4-turbo";
				break;
			}
			if (choice === "4") {
				console.log(chalk.yellow("Enter custom model name:"));
				process.stdout.write(chalk.cyan("> "));
				for await (const customLine of console) {
					model = customLine.trim();
					if (model) break;
				}
				break;
			}
			console.log(chalk.red("Please enter 1, 2, 3, or 4:"));
			process.stdout.write(chalk.cyan("> "));
		}
	} else {
		console.log(
			chalk.yellow(
				"\nEnter OpenRouter model (e.g., 'openai/gpt-4o', 'anthropic/claude-3.5-sonnet'):",
			),
		);
		console.log(
			chalk.gray("Browse available models at: https://openrouter.ai/models"),
		);
		process.stdout.write(chalk.cyan("> "));

		for await (const line of console) {
			model = line.trim();
			if (model) break;
			console.log(chalk.red("Model cannot be empty. Please enter a model:"));
			process.stdout.write(chalk.cyan("> "));
		}
	}

	// Create configuration
	const aiConfig: AIConfiguration = {
		name,
		provider,
		apiKey,
		model,
		baseURL:
			provider === "openrouter" ? "https://openrouter.ai/api/v1" : undefined,
		maxTokens: 100000,
		temperature: 0.7,
	};

	try {
		await configManager.addAIConfiguration(aiConfig);
		console.log(
			chalk.green(`\n✅ Configuration '${name}' added successfully!\n`),
		);

		// Test configuration
		console.log(
			chalk.yellow("Would you like to test this configuration now? (y/n)"),
		);
		process.stdout.write(chalk.cyan("> "));

		for await (const line of console) {
			const input = line.trim().toLowerCase();

			if (input === "y" || input === "yes") {
				console.log(chalk.cyan("\n🔧 Testing configuration..."));
				try {
					const service = new AIService(aiConfig);
					const result = await service.complete([
						{
							role: "user",
							content:
								"Say 'Hello! Connection successful.' if you can read this.",
						},
					]);
					console.log(chalk.green("\n✅ Test successful!"));
					console.log(chalk.gray(`Response: ${result.content}`));
				} catch (error: any) {
					console.error(chalk.red(`\n❌ Test failed: ${error.message}`));
				}
			}
			break;
		}
	} catch (error: any) {
		console.error(
			chalk.red(`\n❌ Failed to add configuration: ${error.message}`),
		);
	}
}
