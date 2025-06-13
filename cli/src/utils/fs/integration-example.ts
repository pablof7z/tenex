/**
 * Example of integrating the file system abstraction with dependency injection
 */
import type { IFileSystem } from "./FileSystem";
import { fs as defaultFs } from "./index";

/**
 * Example: Configuration Manager with dependency injection
 */
export class ConfigurationManager {
	constructor(
		private configPath: string,
		private fs: IFileSystem = defaultFs,
	) {}

	async load<T extends object>(defaults: T): Promise<T> {
		if (!(await this.fs.exists(this.configPath))) {
			await this.save(defaults);
			return defaults;
		}

		try {
			return await this.fs.readJSON<T>(this.configPath);
		} catch (error) {
			console.error(`Failed to load config from ${this.configPath}:`, error);
			return defaults;
		}
	}

	async save<T extends object>(config: T): Promise<void> {
		await this.fs.writeJSON(this.configPath, config);
	}

	async update<T extends object>(
		updater: (config: T) => T | Promise<T>,
	): Promise<T> {
		const current = await this.load({} as T);
		const updated = await updater(current);
		await this.save(updated);
		return updated;
	}
}

/**
 * Example: Project Manager with dependency injection
 */
export class ProjectManager {
	constructor(
		private basePath: string,
		private fs: IFileSystem = defaultFs,
	) {}

	async createProject(name: string, template?: string): Promise<string> {
		const projectPath = this.fs.join(this.basePath, name);

		// Check if project already exists
		if (await this.fs.exists(projectPath)) {
			throw new Error(`Project '${name}' already exists`);
		}

		// Create project structure
		const dirs = [
			projectPath,
			this.fs.join(projectPath, ".tenex"),
			this.fs.join(projectPath, ".tenex/agents"),
			this.fs.join(projectPath, ".tenex/rules"),
			this.fs.join(projectPath, "src"),
		];

		for (const dir of dirs) {
			await this.fs.ensureDir(dir);
		}

		// Create initial files
		const projectConfig = {
			name,
			version: "1.0.0",
			created: new Date().toISOString(),
			template: template || "default",
		};

		await this.fs.writeJSON(
			this.fs.join(projectPath, ".tenex/project.json"),
			projectConfig,
		);

		await this.fs.writeFile(
			this.fs.join(projectPath, "README.md"),
			`# ${name}\n\nCreated with TENEX CLI\n`,
		);

		return projectPath;
	}

	async listProjects(): Promise<
		Array<{ name: string; path: string; config: unknown }>
	> {
		const projects: Array<{ name: string; path: string; config: unknown }> = [];

		if (!(await this.fs.exists(this.basePath))) {
			return projects;
		}

		const entries = await this.fs.readdir(this.basePath);

		for (const entry of entries) {
			const projectPath = this.fs.join(this.basePath, entry);
			const configPath = this.fs.join(projectPath, ".tenex/project.json");

			if (await this.fs.exists(configPath)) {
				try {
					const config = await this.fs.readJSON(configPath);
					projects.push({ name: entry, path: projectPath, config });
				} catch (error) {
					console.warn(`Failed to load project config for ${entry}:`, error);
				}
			}
		}

		return projects;
	}

	async deleteProject(name: string): Promise<void> {
		const projectPath = this.fs.join(this.basePath, name);

		if (!(await this.fs.exists(projectPath))) {
			throw new Error(`Project '${name}' not found`);
		}

		await this.fs.rmdir(projectPath, { recursive: true });
	}
}

/**
 * Example: Agent Manager with file system abstraction
 */
export class AgentManager {
	private agentsPath: string;

	constructor(
		projectPath: string,
		private fs: IFileSystem = defaultFs,
	) {
		this.agentsPath = this.fs.join(projectPath, ".tenex/agents.json");
	}

	async getAgents(): Promise<Record<string, string>> {
		if (!(await this.fs.exists(this.agentsPath))) {
			return {};
		}
		return await this.fs.readJSON(this.agentsPath);
	}

	async addAgent(name: string, nsec: string): Promise<void> {
		const agents = await this.getAgents();
		agents[name] = nsec;
		await this.fs.writeJSON(this.agentsPath, agents);
	}

	async removeAgent(name: string): Promise<void> {
		const agents = await this.getAgents();
		delete agents[name];
		await this.fs.writeJSON(this.agentsPath, agents);
	}

	async hasAgent(name: string): Promise<boolean> {
		const agents = await this.getAgents();
		return name in agents;
	}
}

/**
 * Example: Testing these classes with MockFileSystem
 */
import { MockFileSystem } from "./MockFileSystem";

export async function testExample() {
	// Create a mock file system
	const mockFs = new MockFileSystem();

	// Test ConfigurationManager
	const configManager = new ConfigurationManager(
		"~/.tenex/config.json",
		mockFs,
	);

	const defaultConfig = { version: "1.0.0", theme: "dark" };
	const config = await configManager.load(defaultConfig);
	console.log("Loaded config:", config);

	await configManager.update((cfg) => ({ ...cfg, theme: "light" }));
	const updated = await configManager.load(defaultConfig);
	console.log("Updated config:", updated);

	// Test ProjectManager
	const projectManager = new ProjectManager("/projects", mockFs);

	await projectManager.createProject("my-app", "react");
	await projectManager.createProject("my-api", "express");

	const projects = await projectManager.listProjects();
	console.log("Projects:", projects);

	// Test AgentManager
	const agentManager = new AgentManager("/projects/my-app", mockFs);

	await agentManager.addAgent("default", "nsec1...");
	await agentManager.addAgent("planner", "nsec2...");

	const agents = await agentManager.getAgents();
	console.log("Agents:", agents);

	// Verify all files were created
	const allFiles = mockFs.getAllFiles();
	console.log("All created files:", allFiles);
}

/**
 * Example: Factory pattern for creating instances with proper file system
 */
export class CliServices {
	constructor(private fs: IFileSystem = defaultFs) {}

	createConfigManager(configPath: string): ConfigurationManager {
		return new ConfigurationManager(configPath, this.fs);
	}

	createProjectManager(basePath: string): ProjectManager {
		return new ProjectManager(basePath, this.fs);
	}

	createAgentManager(projectPath: string): AgentManager {
		return new AgentManager(projectPath, this.fs);
	}
}

// Usage in production
const services = new CliServices();
const configManager = services.createConfigManager("~/.tenex/config.json");

// Usage in tests
const mockServices = new CliServices(new MockFileSystem());
const testConfigManager = mockServices.createConfigManager("/test/config.json");
