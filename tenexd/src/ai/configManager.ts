import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import chalk from "chalk";
import { AIService } from "./service.js";
import { type AIConfig, AIConfigSchema, type AIModelConfig } from "./types.js";

export class AIConfigManager {
    private configPath: string;
    private config: AIConfig | null = null;
    private services: Map<string, AIService> = new Map();

    constructor(configPath = "./ai-config.json") {
        this.configPath = configPath;
    }

    async load(): Promise<AIConfig> {
        if (existsSync(this.configPath)) {
            const data = readFileSync(this.configPath, "utf-8");
            const parsed = JSON.parse(data);
            this.config = AIConfigSchema.parse(parsed);

            // Initialize services for each configuration
            for (const modelConfig of this.config.configurations) {
                this.services.set(modelConfig.name, new AIService(modelConfig));
            }

            return this.config;
        }

        // Create default empty config
        this.config = {
            configurations: [],
            defaultConfiguration: undefined,
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

    async getConfig(): Promise<AIConfig> {
        if (!this.config) {
            return await this.load();
        }
        return this.config;
    }

    async addConfiguration(modelConfig: AIModelConfig): Promise<void> {
        const config = await this.getConfig();

        // Check if name already exists
        const existing = config.configurations.find((c) => c.name === modelConfig.name);
        if (existing) {
            throw new Error(`Configuration with name '${modelConfig.name}' already exists`);
        }

        config.configurations.push(modelConfig);

        // Set as default if it's the first configuration
        if (config.configurations.length === 1) {
            config.defaultConfiguration = modelConfig.name;
        }

        // Initialize service
        this.services.set(modelConfig.name, new AIService(modelConfig));

        this.save();
    }

    async updateConfiguration(name: string, updates: Partial<AIModelConfig>): Promise<void> {
        const config = await this.getConfig();
        const index = config.configurations.findIndex((c) => c.name === name);

        if (index === -1) {
            throw new Error(`Configuration '${name}' not found`);
        }

        // If renaming, check new name doesn't exist
        if (updates.name && updates.name !== name) {
            const existing = config.configurations.find((c) => c.name === updates.name);
            if (existing) {
                throw new Error(`Configuration with name '${updates.name}' already exists`);
            }
        }

        // Update configuration
        config.configurations[index] = {
            ...config.configurations[index],
            ...updates,
        };

        // Update service
        this.services.delete(name);
        this.services.set(
            config.configurations[index].name,
            new AIService(config.configurations[index])
        );

        // Update default if needed
        if (config.defaultConfiguration === name && updates.name) {
            config.defaultConfiguration = updates.name;
        }

        this.save();
    }

    async removeConfiguration(name: string): Promise<void> {
        const config = await this.getConfig();
        config.configurations = config.configurations.filter((c) => c.name !== name);

        // Remove service
        this.services.delete(name);

        // Update default if needed
        if (config.defaultConfiguration === name) {
            config.defaultConfiguration = config.configurations[0]?.name;
        }

        this.save();
    }

    async setDefaultConfiguration(name: string): Promise<void> {
        const config = await this.getConfig();
        const exists = config.configurations.find((c) => c.name === name);

        if (!exists) {
            throw new Error(`Configuration '${name}' not found`);
        }

        config.defaultConfiguration = name;
        this.save();
    }

    async getService(name?: string): Promise<AIService | null> {
        const config = await this.getConfig();

        let configName = name;
        if (!configName) {
            configName = config.defaultConfiguration;
        }

        if (!configName) {
            return null;
        }

        return this.services.get(configName) || null;
    }

    async listConfigurations(): Promise<string[]> {
        const config = await this.getConfig();
        return config.configurations.map((c) => c.name);
    }

    async getConfiguration(name: string): Promise<AIModelConfig | null> {
        const config = await this.getConfig();
        return config.configurations.find((c) => c.name === name) || null;
    }

    hasConfigurations(): boolean {
        return this.config ? this.config.configurations.length > 0 : false;
    }

    async testConfiguration(name: string): Promise<boolean> {
        const service = await this.getService(name);
        if (!service) {
            throw new Error(`Configuration '${name}' not found`);
        }

        console.log(chalk.yellow(`Testing configuration '${name}'...`));
        const success = await service.testConnection();

        if (success) {
            console.log(chalk.green(`✅ Configuration '${name}' is working`));
        } else {
            console.log(chalk.red(`❌ Configuration '${name}' failed`));
        }

        return success;
    }

    async testAllConfigurations(): Promise<void> {
        const config = await this.getConfig();

        for (const modelConfig of config.configurations) {
            await this.testConfiguration(modelConfig.name);
        }
    }
}
