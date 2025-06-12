import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import chalk from "chalk";
import {
	logError,
	logInfo,
	logSuccess,
	logWarning,
} from "../../../shared/src/logger.js";
import type { Config, ConfigManager } from "../config/config.js";

interface RunningProject {
	process: ChildProcess;
	projectPath: string;
	projectId: string;
	startedAt: Date;
}

export class ProcessManager {
	private runningProjects: Map<string, RunningProject> = new Map();
	private tenexCommand: string;

	constructor(
		private config: Config,
		private configManager: ConfigManager,
	) {
		// Determine the tenex command to use
		this.tenexCommand = config.tenexCommand || "npx tenex";

		// Set up process cleanup on exit
		process.on("SIGINT", () => this.cleanup());
		process.on("SIGTERM", () => this.cleanup());
		process.on("exit", () => this.cleanup());
	}

	/**
	 * Check if a project is running
	 */
	isProjectRunning(projectId: string): boolean {
		const runningProject = this.runningProjects.get(projectId);

		if (!runningProject) return false;

		// Check if process is still alive
		try {
			process.kill(runningProject.process.pid!, 0);
			return true;
		} catch {
			// Process is dead, remove from map
			this.runningProjects.delete(projectId);
			return false;
		}
	}

	/**
	 * Initialize llms.json if it doesn't exist
	 */
	private async initializeLLMsFile(projectPath: string): Promise<void> {
		const llmsPath = path.join(projectPath, ".tenex", "llms.json");

		try {
			// Check if llms.json already exists
			const fs = await import("node:fs/promises");
			await fs.access(llmsPath);
			logInfo("Found existing llms.json");
		} catch {
			// Create llms.json from tenexd's AI configuration
			try {
				const fs = await import("node:fs/promises");
				const tenexDir = path.join(projectPath, ".tenex");
				await fs.mkdir(tenexDir, { recursive: true });

				// Get all AI configurations from config
				const config = await this.configManager.getConfig();
				const aiConfigs = config.aiConfigurations || [];
				const llmsConfig: Record<string, any> = {};

				for (const aiConfig of aiConfigs) {
					llmsConfig[aiConfig.name] = {
						provider: aiConfig.provider,
						model: aiConfig.model,
						apiKey: aiConfig.apiKey,
						...(aiConfig.baseURL && { baseURL: aiConfig.baseURL }),
						...(aiConfig.maxTokens && { maxTokens: aiConfig.maxTokens }),
						...(aiConfig.temperature && { temperature: aiConfig.temperature }),
					};
				}

				// Set the default configuration reference
				// The llms.json format expects either:
				// 1. A single config named "default" (no separate default property needed)
				// 2. Multiple configs with a "default" property pointing to the default config name

				if (config.defaultAIConfiguration) {
					// Check if we have a config with the same name as defaultAIConfiguration
					const hasDefaultConfig = aiConfigs.some(
						(cfg) => cfg.name === config.defaultAIConfiguration,
					);

					if (hasDefaultConfig) {
						// If there's only one config and it matches the default, no need for a separate default property
						if (
							aiConfigs.length === 1 &&
							aiConfigs[0].name === config.defaultAIConfiguration
						) {
							// Single config scenario - no default property needed
						} else {
							// Multiple configs - add default property
							llmsConfig.default = config.defaultAIConfiguration;
						}
					} else {
						// defaultAIConfiguration doesn't match any config name - shouldn't happen but handle it
						if (aiConfigs.length > 0) {
							llmsConfig.default = aiConfigs[0].name;
						}
					}
				}

				await fs.writeFile(llmsPath, JSON.stringify(llmsConfig, null, 2));
				logSuccess("Created llms.json from tenexd configuration");
			} catch (err: any) {
				logError(`Failed to create llms.json: ${err.message}`);
			}
		}
	}

	/**
	 * Start tenex run for a project
	 */
	async startProject(projectId: string, projectPath: string): Promise<void> {
		// Check if already running
		if (this.isProjectRunning(projectId)) {
			logInfo(`[${projectId}] Project is already running`);
			return;
		}

		try {
			// Initialize llms.json if needed
			await this.initializeLLMsFile(projectPath);

			// Build the command - no arguments needed
			const args = ["run"];

			// No environment variables needed - tenex run will read llms.json
			const env = {
				...process.env,
				TENEX_PROJECT_ID: projectId,
			};

			console.log(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
			console.log(chalk.cyan("🚀 Starting Project Process"));
			console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
			console.log(chalk.gray("Project:   ") + chalk.white(projectId));
			console.log(chalk.gray("Directory: ") + chalk.white(projectPath));
			console.log(
				chalk.gray("Command:   ") +
					chalk.yellow(`${this.tenexCommand} ${args.join(" ")}`),
			);
			console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));

			// Spawn the process
			const child = spawn(this.tenexCommand, args, {
				cwd: projectPath,
				env,
				stdio: ["pipe", "pipe", "pipe"],
				shell: true,
			});

			// Prepend project ID to all output
			child.stdout?.on("data", (data) => {
				const lines = data.toString().split("\n");
				lines.forEach((line: string) => {
					if (line.trim()) {
						console.log(`${chalk.gray(`[${projectId}]`)} ${line}`);
					}
				});
			});

			child.stderr?.on("data", (data) => {
				const lines = data.toString().split("\n");
				lines.forEach((line: string) => {
					if (line.trim()) {
						console.error(`${chalk.red(`[${projectId}]`)} ${chalk.red(line)}`);
					}
				});
			});

			child.on("error", (error) => {
				logError(`[${projectId}] Failed to start project: ${error.message}`);
				this.runningProjects.delete(projectId);
			});

			child.on("exit", (code) => {
				if (code === 0) {
					logInfo(`[${projectId}] Project exited normally`);
				} else {
					logWarning(`[${projectId}] Project exited with code ${code}`);
				}
				this.runningProjects.delete(projectId);
			});

			// Store the running project
			this.runningProjects.set(projectId, {
				process: child,
				projectPath,
				projectId,
				startedAt: new Date(),
			});

			logSuccess(`[${projectId}] Project started successfully`);
		} catch (err: any) {
			logError(`[${projectId}] Failed to start project: ${err.message}`);
		}
	}

	/**
	 * Stop a project
	 */
	stopProject(projectId: string): void {
		const runningProject = this.runningProjects.get(projectId);

		if (!runningProject) {
			logWarning(`[${projectId}] Project is not running`);
			return;
		}

		try {
			logInfo(`[${projectId}] Stopping project`);
			runningProject.process.kill("SIGTERM");
			this.runningProjects.delete(projectId);
		} catch (err: any) {
			logError(`[${projectId}] Failed to stop project: ${err.message}`);
		}
	}

	/**
	 * Get all running projects
	 */
	getRunningProjects(): Array<{ projectId: string; startedAt: Date }> {
		const projects: Array<{ projectId: string; startedAt: Date }> = [];

		this.runningProjects.forEach((runningProject, projectId) => {
			// Check if still alive
			if (this.isProjectRunning(projectId)) {
				projects.push({
					projectId: runningProject.projectId,
					startedAt: runningProject.startedAt,
				});
			}
		});

		return projects;
	}

	/**
	 * Clean up all running processes
	 */
	private cleanup(): void {
		logInfo("Cleaning up running projects...");

		this.runningProjects.forEach((runningProject, projectId) => {
			try {
				runningProject.process.kill("SIGTERM");
				logInfo(`[${runningProject.projectId}] Stopped project`);
			} catch (err) {
				// Process might already be dead
			}
		});

		this.runningProjects.clear();
	}
}
