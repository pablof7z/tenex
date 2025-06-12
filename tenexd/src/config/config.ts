import { existsSync, readFileSync, writeFileSync } from "fs";
import { mkdirSync } from "fs";
import { hostname } from "os";
import { dirname } from "path";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { AIConfiguration } from "../ai/types.js";

export interface Config {
	privateKey: string;
	publicKey: string;
	relays: string[];
	whitelistedPubkeys: string[];
	hostname: string;
	projectsPath: string;
	taskCommand: string;
	chatCommand?: string;
	tenexCommand?: string;
	aiConfigurations?: AIConfiguration[];
	defaultAIConfiguration?: string;
}

export class ConfigManager {
	private configPath: string;
	private config: Config | null = null;

	constructor(configPath = "./config.json") {
		this.configPath = configPath;
	}

	async load(): Promise<Config> {
		if (existsSync(this.configPath)) {
			const data = readFileSync(this.configPath, "utf-8");
			this.config = JSON.parse(data);

			// Validate required fields
			if (!this.config!.projectsPath) {
				throw new Error(
					"Configuration error: 'projectsPath' is required but not set in config.json",
				);
			}
			if (!this.config!.taskCommand) {
				throw new Error(
					"Configuration error: 'taskCommand' is required but not set in config.json",
				);
			}

			// Migrate from ai-config.json if needed
			await this.migrateAIConfig();

			return this.config!;
		}

		const signer = NDKPrivateKeySigner.generate();
		const privateKey = signer.privateKey;
		const user = await signer.user();

		this.config = {
			privateKey: privateKey!,
			publicKey: user.pubkey,
			relays: [
				"wss://relay.damus.io",
				"wss://relay.primal.net",
				"wss://nos.lol",
				"wss://relay.nostr.band",
			],
			whitelistedPubkeys: [],
			hostname: hostname(),
			projectsPath: "./projects",
			taskCommand: "tenex run --roo",
			chatCommand: undefined,
			tenexCommand: "npx tenex",
			aiConfigurations: [],
			defaultAIConfiguration: undefined,
		};

		this.save();
		return this.config;
	}

	save(): void {
		if (!this.config) throw new Error("No configuration loaded");

		const dir = dirname(this.configPath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}

		writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
	}

	async getConfig(): Promise<Config> {
		if (!this.config) {
			return await this.load();
		}
		return this.config;
	}

	async addWhitelistedPubkey(pubkey: string): Promise<void> {
		const config = await this.getConfig();
		if (!config.whitelistedPubkeys.includes(pubkey)) {
			config.whitelistedPubkeys.push(pubkey);
			this.save();
		}
	}

	async removeWhitelistedPubkey(pubkey: string): Promise<void> {
		const config = await this.getConfig();
		config.whitelistedPubkeys = config.whitelistedPubkeys.filter(
			(pk) => pk !== pubkey,
		);
		this.save();
	}

	async addAIConfiguration(config: AIConfiguration): Promise<void> {
		const currentConfig = await this.getConfig();
		if (!currentConfig.aiConfigurations) {
			currentConfig.aiConfigurations = [];
		}

		// Check if a configuration with this name already exists
		const existingIndex = currentConfig.aiConfigurations.findIndex(
			(c) => c.name === config.name,
		);
		if (existingIndex >= 0) {
			// Update existing
			currentConfig.aiConfigurations[existingIndex] = config;
		} else {
			// Add new
			currentConfig.aiConfigurations.push(config);
		}

		// Set as default if it's the only configuration
		if (currentConfig.aiConfigurations.length === 1) {
			currentConfig.defaultAIConfiguration = config.name;
		}

		this.save();
	}

	async setDefaultAIConfiguration(name: string): Promise<void> {
		const config = await this.getConfig();
		config.defaultAIConfiguration = name;
		this.save();
	}

	async removeAIConfiguration(name: string): Promise<void> {
		const config = await this.getConfig();
		if (!config.aiConfigurations) return;

		config.aiConfigurations = config.aiConfigurations.filter(
			(c) => c.name !== name,
		);

		// Clear default if it was the removed configuration
		if (config.defaultAIConfiguration === name) {
			config.defaultAIConfiguration =
				config.aiConfigurations.length > 0
					? config.aiConfigurations[0].name
					: undefined;
		}

		this.save();
	}

	async getAIConfiguration(
		name?: string,
	): Promise<AIConfiguration | undefined> {
		const config = await this.getConfig();
		if (!config.aiConfigurations || config.aiConfigurations.length === 0) {
			return undefined;
		}

		const targetName = name || config.defaultAIConfiguration;
		if (!targetName) {
			return config.aiConfigurations[0];
		}

		return config.aiConfigurations.find((c) => c.name === targetName);
	}

	async hasAIConfigurations(): Promise<boolean> {
		const config = await this.getConfig();
		return !!(config.aiConfigurations && config.aiConfigurations.length > 0);
	}

	private async migrateAIConfig(): Promise<void> {
		if (!this.config) return;

		// If we already have AI configurations, skip migration
		if (
			this.config.aiConfigurations &&
			this.config.aiConfigurations.length > 0
		) {
			return;
		}

		// Check if old ai-config.json exists
		const oldAIConfigPath = this.config.aiConfigPath || "./ai-config.json";
		if (!existsSync(oldAIConfigPath)) {
			return;
		}

		try {
			const oldConfigData = readFileSync(oldAIConfigPath, "utf-8");
			const oldConfig = JSON.parse(oldConfigData);

			if (oldConfig.configurations && Array.isArray(oldConfig.configurations)) {
				// Add default values for missing fields
				this.config.aiConfigurations = oldConfig.configurations.map(
					(config: any) => ({
						name: config.name,
						provider: config.provider,
						apiKey: config.apiKey,
						model: config.model,
						baseURL: config.baseURL,
						maxTokens: config.maxTokens || 100000,
						temperature: config.temperature || 0.7,
					}),
				);

				this.config.defaultAIConfiguration = oldConfig.defaultConfiguration;

				// Remove old aiConfigPath field
				delete (this.config as any).aiConfigPath;

				// Save the migrated config
				this.save();

				console.log(
					"✅ Migrated AI configurations from ai-config.json to config.json",
				);
			}
		} catch (err) {
			console.error("Failed to migrate AI config:", err);
		}
	}
}
