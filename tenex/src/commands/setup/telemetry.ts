import os from "node:os";
import path from "node:path";
import * as fileSystem from "@tenex/shared/fs";
import { logger } from "@tenex/shared/node";
import type { GlobalConfig } from "@tenex/types/config";
import type {
    LogsConfig,
    MetricsConfig,
    TELEMETRY_PROVIDERS,
    TelemetryConfig,
    TelemetryConfigs,
    TelemetryProvider,
    TracingConfig,
} from "@tenex/types/telemetry";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";

interface TelemetryConfigWithName extends TelemetryConfig {
    name: string;
}

export const telemetryCommand = new Command("telemetry")
    .description(
        "Manage OpenTelemetry configurations (global by default, --project for current project)"
    )
    .option("--project", "Use project-specific configuration instead of global")
    .action(async (options) => {
        try {
            let configPath: string;
            let configType: string;

            if (options.project) {
                // Project-specific configuration
                const projectPath = process.cwd();
                const _telemetryPath = path.join(projectPath, ".tenex", "telemetry.json");

                // Check if we're in a TENEX project
                if (!(await fileSystem.directoryExists(path.join(projectPath, ".tenex")))) {
                    logger.error(
                        "No .tenex directory found. Make sure you're in a TENEX project directory."
                    );
                    process.exit(1);
                }

                configPath = projectPath;
                configType = "project";
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

                configPath = globalConfigDir;
                configType = "global";
            }

            const telemetryManager = new TelemetryConfigEditor(configPath, configType);
            await telemetryManager.showMainMenu();
        } catch (error) {
            logger.error(`Failed to start telemetry configuration: ${error}`);
            process.exit(1);
        }
    });

export class TelemetryConfigEditor {
    private configPath: string;
    private telemetryPath: string;
    private configType: string;

    constructor(configPath: string, configType = "global") {
        this.configPath = configPath;
        this.configType = configType;

        if (configType === "global") {
            this.telemetryPath = path.join(configPath, "config.json");
        } else {
            this.telemetryPath = path.join(configPath, ".tenex", "telemetry.json");
        }
    }

    async showMainMenu(): Promise<void> {
        const telemetryConfig = await this.loadConfig();
        const configs = this.getConfigList(telemetryConfig);

        logger.info(chalk.cyan(`\n📊 OpenTelemetry Configuration Manager (${this.configType})\n`));

        if (configs.length > 0) {
            logger.info(chalk.green("Current configurations:"));
            configs.forEach((config, index) => {
                const isDefault = telemetryConfig.default === config.name;
                const defaultIndicator = isDefault ? chalk.yellow(" (default)") : "";
                logger.info(`  ${index + 1}. ${chalk.bold(config.name)}${defaultIndicator}`);

                const features = [];
                if (config.tracing?.enabled) features.push("Tracing");
                if (config.metrics?.enabled) features.push("Metrics");
                if (config.logs?.enabled) features.push("Logs");

                logger.info(`     ${features.join(", ") || "No features enabled"}`);
            });
            logger.info();
        }

        const { action } = await inquirer.prompt([
            {
                type: "list",
                name: "action",
                message: "What would you like to do?",
                choices: [
                    { name: "Add new telemetry configuration", value: "add" },
                    ...(configs.length > 0
                        ? [
                              { name: "Test existing configuration", value: "test" },
                              { name: "Edit existing configuration", value: "edit" },
                              { name: "Remove configuration", value: "remove" },
                              { name: "Set default configuration", value: "default" },
                          ]
                        : []),
                    { name: "Exit", value: "exit" },
                ],
            },
        ]);

        switch (action) {
            case "add":
                await this.addConfiguration(telemetryConfig);
                break;
            case "test":
                await this.testExistingConfiguration(telemetryConfig);
                break;
            case "edit":
                await this.editConfiguration(telemetryConfig);
                break;
            case "remove":
                await this.removeConfiguration(telemetryConfig);
                break;
            case "default":
                await this.setDefaultConfiguration(telemetryConfig);
                break;
            case "exit":
                logger.info(chalk.green("\n✅ Configuration saved!"));
                return;
        }

        // Show menu again after action
        await this.showMainMenu();
    }

    private async loadConfig(): Promise<TelemetryConfigs> {
        try {
            if (this.configType === "global") {
                // Load from config.json and extract telemetry section
                const globalConfig =
                    (await fileSystem.readJsonFile<GlobalConfig>(this.telemetryPath)) || {};
                return globalConfig.telemetry || {};
            }
            // Load from project telemetry.json
            return (await fileSystem.readJsonFile<TelemetryConfigs>(this.telemetryPath)) || {};
        } catch (error) {
            logger.error(`Failed to load telemetry configuration: ${error}`);
            return {};
        }
    }

    private async saveConfig(config: TelemetryConfigs): Promise<void> {
        if (this.configType === "global") {
            // Load existing global config and update telemetry section
            let globalConfig: GlobalConfig = {};
            try {
                globalConfig =
                    (await fileSystem.readJsonFile<GlobalConfig>(this.telemetryPath)) || {};
            } catch {
                // File doesn't exist, create new one
            }
            globalConfig.telemetry = config;
            await fileSystem.writeJsonFile(this.telemetryPath, globalConfig, { spaces: 2 });
        } else {
            // Save directly to project telemetry.json
            await fileSystem.writeJsonFile(this.telemetryPath, config, { spaces: 2 });
        }
    }

    private getConfigList(telemetryConfig: TelemetryConfigs): TelemetryConfigWithName[] {
        const configs: TelemetryConfigWithName[] = [];

        for (const [key, value] of Object.entries(telemetryConfig)) {
            if (key !== "default" && typeof value === "object") {
                configs.push({
                    name: key,
                    ...(value as TelemetryConfig),
                });
            }
        }

        return configs;
    }

    private async addConfiguration(telemetryConfig: TelemetryConfigs): Promise<void> {
        logger.info(chalk.cyan("\n➕ Add New Telemetry Configuration\n"));

        // Import the providers here to avoid circular dependency
        const { TELEMETRY_PROVIDERS } = await import("@tenex/types/telemetry");

        const { provider } = await inquirer.prompt([
            {
                type: "list",
                name: "provider",
                message: "Select telemetry provider:",
                choices: TELEMETRY_PROVIDERS.map((p) => ({
                    name: `${p.displayName}${p.requiresAuth ? " (requires auth)" : ""}`,
                    value: p.name,
                })),
            },
        ]);

        const selectedProvider = TELEMETRY_PROVIDERS.find((p) => p.name === provider);
        if (!selectedProvider) {
            logger.error("Invalid provider selected");
            return;
        }

        logger.info(
            chalk.gray(
                `\n📖 ${selectedProvider.displayName} Documentation: ${selectedProvider.documentation}\n`
            )
        );

        // Get basic configuration
        const basicConfig = await inquirer.prompt([
            {
                type: "input",
                name: "configName",
                message: "Configuration name:",
                default: `${provider}-config`,
                validate: (input: string) => {
                    if (!input.trim()) return "Configuration name is required";
                    if (telemetryConfig[input]) return "Configuration name already exists";
                    return true;
                },
            },
            {
                type: "input",
                name: "serviceName",
                message: "Service name:",
                default: "tenex-project",
            },
            {
                type: "input",
                name: "serviceVersion",
                message: "Service version:",
                default: "1.0.0",
            },
            {
                type: "input",
                name: "environment",
                message: "Environment:",
                default: "development",
            },
        ]);

        // Get feature selections
        const features = await inquirer.prompt([
            {
                type: "checkbox",
                name: "enabledFeatures",
                message: "Which telemetry features would you like to enable?",
                choices: [
                    { name: "Tracing", value: "tracing", checked: true },
                    { name: "Metrics", value: "metrics", checked: false },
                    { name: "Logs", value: "logs", checked: false },
                ],
            },
        ]);

        const newConfig: TelemetryConfig = {};

        // Configure tracing
        if (features.enabledFeatures.includes("tracing")) {
            const tracingConfig = await this.configureTracing(selectedProvider);
            newConfig.tracing = {
                enabled: true,
                serviceName: basicConfig.serviceName,
                serviceVersion: basicConfig.serviceVersion,
                environment: basicConfig.environment,
                ...tracingConfig,
            };
        }

        // Configure metrics
        if (features.enabledFeatures.includes("metrics")) {
            const metricsConfig = await this.configureMetrics(selectedProvider);
            newConfig.metrics = {
                enabled: true,
                serviceName: basicConfig.serviceName,
                serviceVersion: basicConfig.serviceVersion,
                environment: basicConfig.environment,
                ...metricsConfig,
            };
        }

        // Configure logs
        if (features.enabledFeatures.includes("logs")) {
            const logsConfig = await this.configureLogs(selectedProvider);
            newConfig.logs = {
                enabled: true,
                serviceName: basicConfig.serviceName,
                serviceVersion: basicConfig.serviceVersion,
                environment: basicConfig.environment,
                ...logsConfig,
            };
        }

        const { setAsDefault } = await inquirer.prompt([
            {
                type: "confirm",
                name: "setAsDefault",
                message: "Set as default configuration?",
                default: Object.keys(telemetryConfig).length === 0,
            },
        ]);

        // Save configuration
        telemetryConfig[basicConfig.configName] = newConfig;

        if (setAsDefault) {
            telemetryConfig.default = basicConfig.configName;
        }

        await this.saveConfig(telemetryConfig);
        logger.info(
            chalk.green(`\n✅ Configuration "${basicConfig.configName}" added successfully!`)
        );
    }

    private async configureTracing(provider: TelemetryProvider): Promise<Partial<TracingConfig>> {
        const config: any = {
            protocol: provider.protocol,
        };

        if (provider.name === "custom") {
            const { endpoint } = await inquirer.prompt([
                {
                    type: "input",
                    name: "endpoint",
                    message: "Tracing endpoint URL:",
                    validate: (input: string) => {
                        if (!input.trim()) return "Endpoint URL is required";
                        try {
                            new URL(input);
                            return true;
                        } catch {
                            return "Please enter a valid URL";
                        }
                    },
                },
            ]);
            config.endpoint = endpoint;
        } else {
            config.endpoint = provider.tracingEndpoint;
        }

        if (provider.requiresAuth) {
            const headers: Record<string, string> = {};
            for (const headerName of provider.authHeaders || []) {
                const { headerValue } = await inquirer.prompt([
                    {
                        type: "password",
                        name: "headerValue",
                        message: `Enter value for ${headerName}:`,
                        mask: "*",
                    },
                ]);
                headers[headerName] = headerValue;
            }
            config.headers = headers;
        }

        return config;
    }

    private async configureMetrics(provider: TelemetryProvider): Promise<Partial<MetricsConfig>> {
        const config: any = {
            protocol: provider.protocol,
        };

        if (provider.name === "custom") {
            const { endpoint } = await inquirer.prompt([
                {
                    type: "input",
                    name: "endpoint",
                    message: "Metrics endpoint URL:",
                    validate: (input: string) => {
                        if (!input.trim()) return "Endpoint URL is required";
                        try {
                            new URL(input);
                            return true;
                        } catch {
                            return "Please enter a valid URL";
                        }
                    },
                },
            ]);
            config.endpoint = endpoint;
        } else {
            config.endpoint = provider.metricsEndpoint;
        }

        if (provider.requiresAuth) {
            const headers: Record<string, string> = {};
            for (const headerName of provider.authHeaders || []) {
                const { headerValue } = await inquirer.prompt([
                    {
                        type: "password",
                        name: "headerValue",
                        message: `Enter value for ${headerName}:`,
                        mask: "*",
                    },
                ]);
                headers[headerName] = headerValue;
            }
            config.headers = headers;
        }

        return config;
    }

    private async configureLogs(provider: TelemetryProvider): Promise<Partial<LogsConfig>> {
        const config: any = {
            protocol: provider.protocol,
        };

        if (provider.name === "custom") {
            const { endpoint } = await inquirer.prompt([
                {
                    type: "input",
                    name: "endpoint",
                    message: "Logs endpoint URL:",
                    validate: (input: string) => {
                        if (!input.trim()) return "Endpoint URL is required";
                        try {
                            new URL(input);
                            return true;
                        } catch {
                            return "Please enter a valid URL";
                        }
                    },
                },
            ]);
            config.endpoint = endpoint;
        } else {
            config.endpoint = provider.logsEndpoint;
        }

        if (provider.requiresAuth) {
            const headers: Record<string, string> = {};
            for (const headerName of provider.authHeaders || []) {
                const { headerValue } = await inquirer.prompt([
                    {
                        type: "password",
                        name: "headerValue",
                        message: `Enter value for ${headerName}:`,
                        mask: "*",
                    },
                ]);
                headers[headerName] = headerValue;
            }
            config.headers = headers;
        }

        return config;
    }

    private async editConfiguration(telemetryConfig: TelemetryConfigs): Promise<void> {
        const configs = this.getConfigList(telemetryConfig);

        const { configName } = await inquirer.prompt([
            {
                type: "list",
                name: "configName",
                message: "Select configuration to edit:",
                choices: configs.map((c) => c.name),
            },
        ]);

        const config = telemetryConfig[configName] as TelemetryConfig;
        logger.info(chalk.cyan(`\n✏️ Editing Configuration: ${configName}\n`));

        const { field } = await inquirer.prompt([
            {
                type: "list",
                name: "field",
                message: "What would you like to edit?",
                choices: [
                    { name: "Service Information", value: "service" },
                    { name: "Tracing Configuration", value: "tracing" },
                    { name: "Metrics Configuration", value: "metrics" },
                    { name: "Logs Configuration", value: "logs" },
                    { name: "Configuration Name", value: "name" },
                ],
            },
        ]);

        switch (field) {
            case "service":
                await this.editServiceInfo(config);
                break;
            case "tracing":
                await this.editTracingConfig(config);
                break;
            case "metrics":
                await this.editMetricsConfig(config);
                break;
            case "logs":
                await this.editLogsConfig(config);
                break;
            case "name":
                await this.editConfigName(telemetryConfig, configName);
                break;
        }

        await this.saveConfig(telemetryConfig);
        logger.info(chalk.green("\n✅ Configuration updated successfully!"));
    }

    private async editServiceInfo(config: TelemetryConfig): Promise<void> {
        const currentService = config.tracing || config.metrics || config.logs || {};

        const serviceInfo = await inquirer.prompt([
            {
                type: "input",
                name: "serviceName",
                message: "Service name:",
                default: currentService.serviceName,
            },
            {
                type: "input",
                name: "serviceVersion",
                message: "Service version:",
                default: currentService.serviceVersion,
            },
            {
                type: "input",
                name: "environment",
                message: "Environment:",
                default: currentService.environment,
            },
        ]);

        // Update all enabled configurations
        if (config.tracing) {
            Object.assign(config.tracing, serviceInfo);
        }
        if (config.metrics) {
            Object.assign(config.metrics, serviceInfo);
        }
        if (config.logs) {
            Object.assign(config.logs, serviceInfo);
        }
    }

    private async editTracingConfig(config: TelemetryConfig): Promise<void> {
        if (!config.tracing) {
            const { enable } = await inquirer.prompt([
                {
                    type: "confirm",
                    name: "enable",
                    message: "Tracing is not enabled. Would you like to enable it?",
                    default: true,
                },
            ]);

            if (enable) {
                config.tracing = { enabled: true };
            } else {
                return;
            }
        }

        const tracingConfig = await inquirer.prompt([
            {
                type: "confirm",
                name: "enabled",
                message: "Enable tracing:",
                default: config.tracing.enabled,
            },
            {
                type: "input",
                name: "endpoint",
                message: "Tracing endpoint:",
                default: config.tracing.endpoint,
                when: (answers) => answers.enabled,
            },
        ]);

        Object.assign(config.tracing, tracingConfig);
    }

    private async editMetricsConfig(config: TelemetryConfig): Promise<void> {
        if (!config.metrics) {
            const { enable } = await inquirer.prompt([
                {
                    type: "confirm",
                    name: "enable",
                    message: "Metrics is not enabled. Would you like to enable it?",
                    default: true,
                },
            ]);

            if (enable) {
                config.metrics = { enabled: true };
            } else {
                return;
            }
        }

        const metricsConfig = await inquirer.prompt([
            {
                type: "confirm",
                name: "enabled",
                message: "Enable metrics:",
                default: config.metrics.enabled,
            },
            {
                type: "input",
                name: "endpoint",
                message: "Metrics endpoint:",
                default: config.metrics.endpoint,
                when: (answers) => answers.enabled,
            },
        ]);

        Object.assign(config.metrics, metricsConfig);
    }

    private async editLogsConfig(config: TelemetryConfig): Promise<void> {
        if (!config.logs) {
            const { enable } = await inquirer.prompt([
                {
                    type: "confirm",
                    name: "enable",
                    message: "Logs is not enabled. Would you like to enable it?",
                    default: true,
                },
            ]);

            if (enable) {
                config.logs = { enabled: true };
            } else {
                return;
            }
        }

        const logsConfig = await inquirer.prompt([
            {
                type: "confirm",
                name: "enabled",
                message: "Enable logs:",
                default: config.logs.enabled,
            },
            {
                type: "input",
                name: "endpoint",
                message: "Logs endpoint:",
                default: config.logs.endpoint,
                when: (answers) => answers.enabled,
            },
        ]);

        Object.assign(config.logs, logsConfig);
    }

    private async editConfigName(
        telemetryConfig: TelemetryConfigs,
        currentName: string
    ): Promise<void> {
        const { newName } = await inquirer.prompt([
            {
                type: "input",
                name: "newName",
                message: "Enter new configuration name:",
                default: currentName,
                validate: (input: string) => {
                    if (!input.trim()) return "Configuration name is required";
                    if (input !== currentName && telemetryConfig[input]) {
                        return "Configuration name already exists";
                    }
                    return true;
                },
            },
        ]);

        if (newName !== currentName) {
            telemetryConfig[newName] = telemetryConfig[currentName];
            delete telemetryConfig[currentName];

            // Update default if it was pointing to the old name
            if (telemetryConfig.default === currentName) {
                telemetryConfig.default = newName;
            }
        }
    }

    private async removeConfiguration(telemetryConfig: TelemetryConfigs): Promise<void> {
        const configs = this.getConfigList(telemetryConfig);

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

        if (!confirm) return;

        delete telemetryConfig[configName];

        // If this was the default, clear it
        if (telemetryConfig.default === configName) {
            telemetryConfig.default = undefined;
        }

        await this.saveConfig(telemetryConfig);
        logger.info(chalk.green(`\n✅ Configuration "${configName}" removed successfully!`));
    }

    private async setDefaultConfiguration(telemetryConfig: TelemetryConfigs): Promise<void> {
        const configs = this.getConfigList(telemetryConfig);

        const { configName } = await inquirer.prompt([
            {
                type: "list",
                name: "configName",
                message: "Select default configuration:",
                choices: configs.map((c) => ({
                    name: c.name + (telemetryConfig.default === c.name ? " (current default)" : ""),
                    value: c.name,
                })),
            },
        ]);

        telemetryConfig.default = configName;
        await this.saveConfig(telemetryConfig);
        logger.info(chalk.green(`\n✅ Default configuration set to "${configName}"!`));
    }

    private async testExistingConfiguration(telemetryConfig: TelemetryConfigs): Promise<void> {
        const configs = this.getConfigList(telemetryConfig);

        const { configName } = await inquirer.prompt([
            {
                type: "list",
                name: "configName",
                message: "Select configuration to test:",
                choices: configs.map((c) => ({
                    name: `${c.name}`,
                    value: c.name,
                })),
            },
        ]);

        const config = telemetryConfig[configName] as TelemetryConfig;
        await this.testConfiguration(config, configName);
    }

    private async testConfiguration(config: TelemetryConfig, configName: string): Promise<boolean> {
        logger.info(chalk.cyan(`\n🧪 Testing configuration "${configName}"...`));

        // Simple connectivity test - try to reach the endpoints
        let allTestsPassed = true;

        if (config.tracing?.enabled && config.tracing.endpoint) {
            logger.info(chalk.gray(`Testing tracing endpoint: ${config.tracing.endpoint}`));
            try {
                const url = new URL(config.tracing.endpoint);
                const response = await fetch(`${url.protocol}//${url.host}`, {
                    method: "HEAD",
                    signal: AbortSignal.timeout(5000),
                });
                logger.info(chalk.green(`✅ Tracing endpoint reachable (${response.status})`));
            } catch (error) {
                logger.info(
                    chalk.red(
                        `❌ Tracing endpoint unreachable: ${error instanceof Error ? error.message : String(error)}`
                    )
                );
                allTestsPassed = false;
            }
        }

        if (config.metrics?.enabled && config.metrics.endpoint) {
            logger.info(chalk.gray(`Testing metrics endpoint: ${config.metrics.endpoint}`));
            try {
                const url = new URL(config.metrics.endpoint);
                const response = await fetch(`${url.protocol}//${url.host}`, {
                    method: "HEAD",
                    signal: AbortSignal.timeout(5000),
                });
                logger.info(chalk.green(`✅ Metrics endpoint reachable (${response.status})`));
            } catch (error) {
                logger.info(
                    chalk.red(
                        `❌ Metrics endpoint unreachable: ${error instanceof Error ? error.message : String(error)}`
                    )
                );
                allTestsPassed = false;
            }
        }

        if (config.logs?.enabled && config.logs.endpoint) {
            logger.info(chalk.gray(`Testing logs endpoint: ${config.logs.endpoint}`));
            try {
                const url = new URL(config.logs.endpoint);
                const response = await fetch(`${url.protocol}//${url.host}`, {
                    method: "HEAD",
                    signal: AbortSignal.timeout(5000),
                });
                logger.info(chalk.green(`✅ Logs endpoint reachable (${response.status})`));
            } catch (error) {
                logger.info(
                    chalk.red(
                        `❌ Logs endpoint unreachable: ${error instanceof Error ? error.message : String(error)}`
                    )
                );
                allTestsPassed = false;
            }
        }

        if (allTestsPassed) {
            logger.info(chalk.green("\n✅ All tests passed!"));
        } else {
            logger.info(
                chalk.yellow(
                    "\n⚠️  Some tests failed. Check your configuration and network connectivity."
                )
            );
        }

        return allTestsPassed;
    }
}
