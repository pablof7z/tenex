import type { NDK, NDKEvent } from "@nostr-dev-kit/ndk";
import type { LLMConfig } from "@tenex/types/llm";
import type { ProjectInfo } from "../../commands/run/ProjectLoader";
import { logger } from "../logger";
import type { Agent } from "./Agent";
import { AgentConfigurationManager } from "./AgentConfigurationManager";
import { AgentEventHandler } from "./AgentEventHandler";
import { AgentOrchestrator } from "./AgentOrchestrator";
import { ConversationStorage } from "./ConversationStorage";
import type { ToolRegistry } from "./tools/ToolRegistry";
import type { ToolDefinition } from "./tools/types";

/**
 * Main AgentManager class that orchestrates all agent operations
 * Now refactored into focused modules for better maintainability
 */
export class AgentManager {
	private projectPath: string;
	private conversationStorage: ConversationStorage;
	private _projectInfo?: ProjectInfo;
	private ndk?: NDK;

	// Modular components
	private configManager: AgentConfigurationManager;
	private eventHandler: AgentEventHandler;
	private orchestrator: AgentOrchestrator;

	constructor(projectPath: string, projectInfo?: ProjectInfo) {
		this.projectPath = projectPath;
		this._projectInfo = projectInfo;
		this.conversationStorage = new ConversationStorage(projectPath);

		// Initialize modular components
		this.configManager = new AgentConfigurationManager(projectPath);
		this.orchestrator = new AgentOrchestrator(
			this.configManager,
			this.conversationStorage,
			this._projectInfo,
		);

		// Create event handler but don't pass agents Map yet (it's empty)
		// We'll update it after initialization
		this.eventHandler = new AgentEventHandler(
			this.configManager,
			this.conversationStorage,
			new Map(), // Empty map for now
			this._projectInfo,
		);

		// Set dependencies for event handler
		this.eventHandler.setDependencies({
			getAgent: (name) => this.orchestrator.getAgent(name),
			getAgentByPubkey: (pubkey) => this.orchestrator.getAgentByPubkey(pubkey),
			isEventFromAnyAgent: (pubkey) =>
				this.orchestrator.isEventFromAnyAgent(pubkey),
			formatAvailableAgentsForPrompt: (excludeAgent) =>
				this.orchestrator.formatAvailableAgentsForPrompt(excludeAgent),
			generateEnvironmentContext: (agentName) =>
				this.orchestrator.generateEnvironmentContext(agentName),
			getAllAvailableAgents: () => this.orchestrator.getAllAvailableAgents(),
		});

		// Set agent manager reference for all agents
		this.orchestrator.setAgentManagerForAll(this);
	}

	setNDK(ndk: NDK): void {
		this.ndk = ndk;
		this.orchestrator.setNDK(ndk);
	}

	async initialize(): Promise<void> {
		// Initialize conversation storage
		await this.conversationStorage.initialize();

		// Initialize configuration manager
		await this.configManager.initialize();

		// Initialize orchestrator (loads agents)
		await this.orchestrator.initialize();

		// Update event handler with loaded agents
		this.eventHandler.updateAgentsMap(this.orchestrator.getAllAgents());

		// Clean up old conversations (older than 30 days)
		await this.conversationStorage.cleanupOldConversations();
		logger.info("Cleaned up old conversations");
	}

	// Delegate LLM configuration methods to configuration manager
	getLLMConfig(name?: string): LLMConfig | undefined {
		return this.configManager.getLLMConfig(name);
	}

	getLLMConfigForAgent(agentName: string): LLMConfig | undefined {
		return this.configManager.getLLMConfigForAgent(agentName);
	}

	getAllLLMConfigs(): Map<string, LLMConfig> {
		return this.configManager.getAllLLMConfigs();
	}

	// Delegate agent management methods to orchestrator
	async getAgent(name = "default"): Promise<Agent> {
		return this.orchestrator.getAgent(name);
	}

	async getAgentByPubkey(pubkey: string): Promise<Agent | undefined> {
		return this.orchestrator.getAgentByPubkey(pubkey);
	}

	getAllAgents(): Map<string, Agent> {
		return this.orchestrator.getAllAgents();
	}

	async getAllAvailableAgents(): Promise<
		Map<string, { description: string; role: string; capabilities: string }>
	> {
		return this.orchestrator.getAllAvailableAgents();
	}

	generateEnvironmentContext(agentName: string): string {
		return this.orchestrator.generateEnvironmentContext(agentName);
	}

	async formatAvailableAgentsForPrompt(excludeAgent?: string): Promise<string> {
		return this.orchestrator.formatAvailableAgentsForPrompt(excludeAgent);
	}

	// Delegate event handling methods to event handler
	async handleChatEvent(
		event: NDKEvent,
		ndk: NDK,
		agentName = "default",
		llmName?: string,
		mentionedPubkeys: string[] = [],
	): Promise<void> {
		return this.eventHandler.handleChatEvent(
			event,
			ndk,
			agentName,
			llmName,
			mentionedPubkeys,
		);
	}

	async handleTaskEvent(
		event: NDKEvent,
		ndk: NDK,
		agentName = "default",
		llmName?: string,
		mentionedPubkeys: string[] = [],
	): Promise<void> {
		return this.eventHandler.handleTaskEvent(
			event,
			ndk,
			agentName,
			llmName,
			mentionedPubkeys,
		);
	}

	// Utility methods
	getProjectPath(): string {
		return this.projectPath;
	}

	getConversationStorage(): ConversationStorage {
		return this.conversationStorage;
	}

	getToolRegistry(): ToolRegistry {
		return this.orchestrator.getToolRegistry();
	}

	registerTool(tool: ToolDefinition): void {
		this.orchestrator.registerTool(tool);
	}

	unregisterTool(toolName: string): void {
		this.orchestrator.unregisterTool(toolName);
	}

	// Delegate helper methods to orchestrator
	async isEventFromAnyAgent(eventPubkey: string): Promise<boolean> {
		return this.orchestrator.isEventFromAnyAgent(eventPubkey);
	}

	// Getter for project info - used by agents to access project information
	get projectInfo(): ProjectInfo | undefined {
		return this._projectInfo;
	}
}
