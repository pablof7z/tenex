import type { NDK, NDKEvent } from "@nostr-dev-kit/ndk";
import type { AgentManager } from "./AgentManager";
import type { Conversation } from "./Conversation";
import type { ConversationStorage } from "./ConversationStorage";
import { loadAgentConfig, saveAgentConfig } from "./core/AgentConfigManager";
import { AgentConversationManager } from "./core/AgentConversationManager";
import { AgentCore } from "./core/AgentCore";
import { AgentResponseGenerator } from "./core/AgentResponseGenerator";
import type { SystemPromptContext } from "./prompts/types";
import type { ToolRegistry } from "./tools/ToolRegistry";
import type { AgentConfig, AgentResponse, LLMConfig } from "./types";

export class Agent {
	private core: AgentCore;
	private conversationManager: AgentConversationManager;
	private responseGenerator: AgentResponseGenerator;

	constructor(
		name: string,
		nsec: string,
		config: AgentConfig,
		storage?: ConversationStorage,
		projectName?: string,
		toolRegistry?: ToolRegistry,
		agentEventId?: string,
	) {
		this.core = new AgentCore(
			name,
			nsec,
			config,
			projectName,
			toolRegistry,
			agentEventId,
		);
		this.conversationManager = new AgentConversationManager(this.core, storage);
		this.responseGenerator = new AgentResponseGenerator(
			this.core,
			this.conversationManager,
		);
	}

	// Delegation methods to core
	getName(): string {
		return this.core.getName();
	}

	getNsec(): string {
		return this.core.getNsec();
	}

	getSigner() {
		return this.core.getSigner();
	}

	getPubkey(): string {
		return this.core.getPubkey();
	}

	getConfig(): AgentConfig {
		return this.core.getConfig();
	}

	setDefaultLLMConfig(config: LLMConfig): void {
		this.core.setDefaultLLMConfig(config);
	}

	getDefaultLLMConfig(): LLMConfig | undefined {
		return this.core.getDefaultLLMConfig();
	}

	setToolRegistry(toolRegistry: ToolRegistry): void {
		this.core.setToolRegistry(toolRegistry);
	}

	getToolRegistry(): ToolRegistry | undefined {
		return this.core.getToolRegistry();
	}

	getAgentEventId(): string | undefined {
		return this.core.getAgentEventId();
	}

	setNDK(ndk: NDK): void {
		this.core.setNDK(ndk);
	}

	setAgentManager(agentManager: AgentManager): void {
		this.core.setAgentManager(agentManager);
	}

	getAgentManager(): AgentManager | undefined {
		return this.core.getAgentManager();
	}

	getSystemPrompt(
		additionalRules?: string,
		environmentContext?: string,
	): string {
		return this.core.getSystemPrompt(additionalRules, environmentContext);
	}

	// Delegation methods to conversation manager
	async createConversation(
		conversationId: string,
		additionalRules?: string,
		environmentContext?: string,
	): Promise<Conversation> {
		return this.conversationManager.createConversation(
			conversationId,
			additionalRules,
			environmentContext,
		);
	}

	getConversation(conversationId: string): Conversation | undefined {
		return this.conversationManager.getConversation(conversationId);
	}

	async getOrCreateConversation(
		conversationId: string,
		additionalRules?: string,
		environmentContext?: string,
	): Promise<Conversation> {
		return this.conversationManager.getOrCreateConversation(
			conversationId,
			additionalRules,
			environmentContext,
		);
	}

	/**
	 * Create conversation with full system prompt context
	 */
	async getOrCreateConversationWithContext(
		conversationId: string,
		context: Partial<SystemPromptContext>,
	): Promise<Conversation> {
		return this.conversationManager.getOrCreateConversationWithContext(
			conversationId,
			context,
		);
	}

	getAllConversations(): Map<string, Conversation> {
		return this.conversationManager.getAllConversations();
	}

	removeConversation(conversationId: string): boolean {
		return this.conversationManager.removeConversation(conversationId);
	}

	extractConversationId(event: NDKEvent): string {
		return this.conversationManager.extractConversationId(event);
	}

	static async loadFromConfig(
		name: string,
		nsec: string,
		projectPath: string,
		storage?: ConversationStorage,
		configFile?: string,
		projectName?: string,
		toolRegistry?: ToolRegistry,
	): Promise<Agent> {
		const { config, agentEventId } = await loadAgentConfig(
			name,
			nsec,
			projectPath,
			storage,
			configFile,
			projectName,
			toolRegistry,
		);
		return new Agent(
			name,
			nsec,
			config,
			storage,
			projectName,
			toolRegistry,
			agentEventId,
		);
	}

	async saveConfig(projectPath: string): Promise<void> {
		await saveAgentConfig(this.getName(), this.getConfig(), projectPath);
	}

	// Delegation methods to response generator
	async generateResponse(
		conversationId: string,
		llmConfig?: LLMConfig,
		projectPath?: string,
		isFromAgent = false,
		typingIndicatorCallback?: (message: string) => Promise<void>,
	): Promise<AgentResponse> {
		return this.responseGenerator.generateResponse(
			conversationId,
			llmConfig,
			projectPath,
			isFromAgent,
			typingIndicatorCallback,
		);
	}

	async generateResponseForEvent(
		event: NDKEvent,
		llmConfig?: LLMConfig,
		projectPath?: string,
		isFromAgent = false,
	): Promise<AgentResponse> {
		return this.responseGenerator.generateResponseForEvent(
			event,
			llmConfig,
			projectPath,
			isFromAgent,
		);
	}
}
