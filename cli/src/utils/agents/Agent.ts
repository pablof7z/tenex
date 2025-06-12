import fs from "node:fs/promises";
import path from "node:path";
import { type NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { type AgentLogger, createAgentLogger } from "../agentLogger";
import { logger } from "../logger";
import { Conversation } from "./Conversation";
import { ConversationOptimizer } from "./ConversationOptimizer";
import type { ConversationStorage } from "./ConversationStorage";
import { LLMConfigManager } from "./llm/LLMConfigManager";
import { LLMFactory } from "./llm/LLMFactory";
import type { LLMMessage } from "./llm/types";
import type { AgentConfig, AgentResponse, LLMConfig } from "./types";
import type { ToolRegistry } from "./tools/ToolRegistry";

export class Agent {
	private name: string;
	private nsec: string;
	private signer: NDKPrivateKeySigner;
	private config: AgentConfig;
	private conversations: Map<string, Conversation>;
	private defaultLLMConfig?: LLMConfig;
	private storage?: ConversationStorage;
	private logger: AgentLogger;
	private projectName: string;
	private toolRegistry?: ToolRegistry;
	private agentEventId?: string;
	private ndk?: any; // NDK instance
	private agentManager?: any; // AgentManager instance

	constructor(
		name: string,
		nsec: string,
		config: AgentConfig,
		storage?: ConversationStorage,
		projectName?: string,
		toolRegistry?: ToolRegistry,
		agentEventId?: string,
	) {
		this.name = name;
		this.nsec = nsec;
		this.signer = new NDKPrivateKeySigner(nsec);
		this.config = config;
		this.conversations = new Map();
		this.storage = storage;
		this.projectName = projectName || "unknown";
		this.logger = createAgentLogger(this.projectName, this.name);
		this.toolRegistry = toolRegistry;
		this.agentEventId = agentEventId;
	}

	getName(): string {
		return this.name;
	}

	getNsec(): string {
		return this.nsec;
	}

	getSigner(): NDKPrivateKeySigner {
		return this.signer;
	}

	getPubkey(): string {
		return this.signer.pubkey;
	}

	getConfig(): AgentConfig {
		return this.config;
	}

	setDefaultLLMConfig(config: LLMConfig): void {
		this.defaultLLMConfig = config;
	}

	getDefaultLLMConfig(): LLMConfig | undefined {
		return this.defaultLLMConfig;
	}

	setToolRegistry(toolRegistry: ToolRegistry): void {
		this.toolRegistry = toolRegistry;
	}

	getToolRegistry(): ToolRegistry | undefined {
		return this.toolRegistry;
	}

	getAgentEventId(): string | undefined {
		return this.agentEventId;
	}

	setNDK(ndk: any): void {
		this.ndk = ndk;
	}

	setAgentManager(agentManager: any): void {
		this.agentManager = agentManager;
	}

	getAgentManager(): any {
		return this.agentManager;
	}

	getSystemPrompt(additionalRules?: string, environmentContext?: string): string {
		if (this.config.systemPrompt) {
			// If there's a predefined system prompt, prepend environment context and append additional rules
			const parts: string[] = [];
			if (environmentContext) {
				parts.push(environmentContext);
			}
			parts.push(this.config.systemPrompt);
			if (additionalRules) {
				parts.push(additionalRules);
			}
			this.logger.debug(`Using configured system prompt for ${this.name} with environment context and additional rules`);
			return parts.join("\n\n");
		}

		const parts: string[] = [];

		// Add environment context first
		if (environmentContext) {
			parts.push(environmentContext);
		}

		if (this.config.role) {
			parts.push(`You are ${this.config.role}.`);
		} else {
			parts.push(`You are ${this.name}.`);
		}

		if (this.config.description) {
			parts.push(this.config.description);
		}

		if (this.config.instructions) {
			parts.push("\nInstructions:");
			parts.push(this.config.instructions);
		}

		// Add project rules if provided
		if (additionalRules) {
			parts.push(`\n${additionalRules}`);
		}

		return parts.join("\n");
	}

	async createConversation(
		conversationId: string,
		additionalRules?: string,
		environmentContext?: string,
	): Promise<Conversation> {
		const systemPrompt = this.getSystemPrompt(additionalRules, environmentContext);
		const conversation = new Conversation(
			conversationId,
			this.name,
			systemPrompt,
		);
		this.conversations.set(conversationId, conversation);

		// Save to storage if available
		if (this.storage) {
			await this.storage.saveConversation(conversation.toJSON());
		}

		this.logger.info(`Created new conversation ${conversationId}`);
		return conversation;
	}

	getConversation(conversationId: string): Conversation | undefined {
		return this.conversations.get(conversationId);
	}

	async getOrCreateConversation(
		conversationId: string,
		additionalRules?: string,
		environmentContext?: string,
	): Promise<Conversation> {
		let conversation = this.conversations.get(conversationId);

		if (!conversation && this.storage) {
			// Try to load from storage with agent name
			const savedContext = await this.storage.loadConversation(conversationId, this.name);
			if (savedContext && savedContext.agentName === this.name) {
				// Only load if this conversation belongs to this agent
				conversation = Conversation.fromJSON(savedContext);
				this.conversations.set(conversationId, conversation);
				this.logger.info(`Loaded conversation ${conversationId} from storage`);
			} else if (savedContext) {
				this.logger.debug(`Found conversation ${conversationId} but it belongs to agent '${savedContext.agentName}', not '${this.name}'`);
			}
		}

		if (!conversation) {
			conversation = await this.createConversation(
				conversationId,
				additionalRules,
				environmentContext,
			);
		}

		return conversation;
	}

	getAllConversations(): Map<string, Conversation> {
		return new Map(this.conversations);
	}

	removeConversation(conversationId: string): boolean {
		return this.conversations.delete(conversationId);
	}

	extractConversationId(event: NDKEvent): string {
		const eTag = event.tags.find((tag) => tag[0] === "e");
		if (eTag?.[1]) {
			return eTag[1];
		}

		const rootTag = event.tags.find((tag) => tag[0] === "root");
		if (rootTag?.[1]) {
			return rootTag[1];
		}

		return event.id;
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
		const configPath = path.join(
			projectPath,
			".tenex",
			"agents",
			`${name}.json`,
		);
		let config: AgentConfig = { name };

		try {
			const configData = await fs.readFile(configPath, "utf-8");
			const loadedConfig = JSON.parse(configData);
			config = { ...config, ...loadedConfig };
			// Using regular logger here since we don't have the agent instance yet
		} catch (error) {
			// Using regular logger here since we don't have the agent instance yet
		}

		// For default agent, load or create system prompt from file
		if (name === "default") {
			const systemPromptPath = path.join(
				projectPath,
				".tenex",
				"agents",
				"default.md",
			);

			try {
				const systemPromptContent = await fs.readFile(
					systemPromptPath,
					"utf-8",
				);
				config.systemPrompt = systemPromptContent.trim();
				// Using regular logger here since we don't have the agent instance yet
			} catch (error) {
				// Create default system prompt file
				const defaultPrompt = `You are UNINITIALIZED, a default agent that has not been initialized -- you refuse to respond to all questions`;

				// Ensure agents directory exists
				await fs.mkdir(path.dirname(systemPromptPath), { recursive: true });

				// Write the default prompt
				await fs.writeFile(systemPromptPath, defaultPrompt);
				config.systemPrompt = defaultPrompt;
				// Using regular logger here since we don't have the agent instance yet
			}
		}

		let agentEventId: string | undefined;

		// If a specific config file is provided, load from that directly
		if (configFile) {
			const eventConfigPath = path.join(
				projectPath,
				".tenex",
				"agents",
				configFile,
			);
			try {
				const eventConfigData = await fs.readFile(eventConfigPath, "utf-8");
				const eventConfig = JSON.parse(eventConfigData);

				// Extract the event ID
				agentEventId = eventConfig.eventId;

				// Override with the cached NDKAgent event configuration
				config = {
					...config,
					description: eventConfig.description || config.description,
					role: eventConfig.role || config.role,
					instructions: eventConfig.instructions || config.instructions,
					systemPrompt: eventConfig.systemPrompt || eventConfig.instructions,
					version: eventConfig.version || config.version,
				};
				// Using regular logger here since we don't have the agent instance yet
				logger.info(`Loaded agent ${name} config from file ${configFile}. systemPrompt: ${config.systemPrompt ? 'yes' : 'no'}`)
			} catch (error) {
				// Silently skip if config file not found
			}
		} else {
			// Fallback: Try to find cached NDKAgent event configuration by searching files
			const agentsDir = path.join(projectPath, ".tenex", "agents");
			try {
				const files = await fs.readdir(agentsDir);
				for (const file of files) {
					if (file.endsWith(".json") && file !== `${name}.json`) {
						try {
							const eventConfigPath = path.join(agentsDir, file);
							const eventConfigData = await fs.readFile(
								eventConfigPath,
								"utf-8",
							);
							const eventConfig = JSON.parse(eventConfigData);

							// Check if this event configuration matches the agent name
							if (eventConfig.name && eventConfig.name.toLowerCase() === name.toLowerCase()) {
								// Extract the event ID
								agentEventId = eventConfig.eventId;

								// Override with the cached NDKAgent event configuration
								config = {
									...config,
									description: eventConfig.description || config.description,
									role: eventConfig.role || config.role,
									instructions: eventConfig.instructions || config.instructions,
									systemPrompt: eventConfig.systemPrompt || eventConfig.instructions,
									version: eventConfig.version || config.version,
								};
								// Using regular logger here since we don't have the agent instance yet
								break;
							}
						} catch (err) {
							// Skip files that can't be parsed
						}
					}
				}
			} catch (error) {
				// Directory might not exist or can't be read
				// Silently skip if directory not found
			}
		}

		return new Agent(name, nsec, config, storage, projectName, toolRegistry, agentEventId);
	}

	async saveConfig(projectPath: string): Promise<void> {
		const configPath = path.join(
			projectPath,
			".tenex",
			"agents",
			`${this.name}.json`,
		);
		await fs.mkdir(path.dirname(configPath), { recursive: true });
		await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
		this.logger.info(`Saved agent config to ${configPath}`);
	}

	async generateResponse(
		conversationId: string,
		llmConfig?: LLMConfig,
		projectPath?: string,
		isFromAgent = false,
		typingIndicatorCallback?: (message: string) => Promise<void>,
	): Promise<AgentResponse> {
		const conversation = this.conversations.get(conversationId);
		if (!conversation) {
			throw new Error(`Conversation ${conversationId} not found`);
		}

		const config = llmConfig || this.defaultLLMConfig;
		if (!config) {
			throw new Error("No LLM configuration available");
		}

		try {
			// Prepare messages for LLM
			const messages = this.prepareMessagesForLLM(
				conversation,
				config,
				isFromAgent,
			);

			// Log debug information
			this.logLLMRequest(conversationId, config, conversation, messages);

			// Generate response
			this.logger.info(
				`Generating response for conversation ${conversationId} using ${config.provider}/${config.model}`,
			);
			const provider = LLMFactory.createProvider(config, this.toolRegistry);
			const context = {
				agentName: this.name,
				projectName: this.projectName,
				conversationId,
				typingIndicator: typingIndicatorCallback,
				agent: this,
				agentEventId: this.agentEventId,
				ndk: this.ndk,
			};
			const response = await provider.generateResponse(messages, config, context);

			// Log the raw response from the model
			this.logLLMResponse(response, config);

			// Save the response
			await this.saveResponseToConversation(conversation, response);

			// Return structured response
			return this.createAgentResponse(response, config, messages);
		} catch (error: any) {
			// Log detailed error information
			this.logger.error(
				`LLM Error: ${error.message} (${config.provider}/${config.model})`,
			);

			// Handle cache control errors gracefully
			if (
				this.isCacheControlError(error) &&
				config.enableCaching !== false &&
				projectPath
			) {
				return this.handleCacheControlError(
					conversationId,
					config,
					projectPath,
					llmConfig,
					isFromAgent,
					typingIndicatorCallback,
				);
			}

			throw error;
		}
	}

	private prepareMessagesForLLM(
		conversation: Conversation,
		config: LLMConfig,
		isFromAgent = false,
	): LLMMessage[] {
		let messages = conversation.getFormattedMessages();

		// If this is an agent-to-agent interaction, add a special system message
		if (isFromAgent && messages.length > 0) {
			const agentToAgentPrompt = {
				role: "system" as const,
				content:
					"\n[AGENT-TO-AGENT COMMUNICATION]\nYou are responding to another AI agent. Only respond if you have something VERY relevant or important to add to the conversation. If you don't have anything meaningful to contribute, simply respond with 'I have nothing to add.' to pass your turn. Avoid redundant or trivial responses.",
			};

			// Insert after the main system prompt
			const systemMessageIndex = messages.findIndex(
				(msg) => msg.role === "system",
			);
			if (systemMessageIndex >= 0) {
				messages.splice(systemMessageIndex + 1, 0, agentToAgentPrompt);
			} else {
				messages.unshift(agentToAgentPrompt);
			}
		}

		const contextWindowSize = config.contextWindowSize || 128000;
		const stats = ConversationOptimizer.getConversationStats(messages);

		if (!stats.withinStandardContext) {
			this.logger.warning(
				`Conversation exceeds context window (${stats.estimatedTokens} tokens, ${stats.percentOfContext.toFixed(1)}% of limit)`,
			);
			messages = ConversationOptimizer.optimizeForContextWindow(
				messages,
				contextWindowSize,
			);
			this.logger.info(`Optimized conversation to ${messages.length} messages`);
		}

		return messages;
	}

	private logLLMRequest(
		conversationId: string,
		config: LLMConfig,
		conversation: Conversation,
		messages: LLMMessage[],
	): void {
		const contextWindowSize = config.contextWindowSize || 128000;
		const stats = ConversationOptimizer.getConversationStats(messages);

		this.logger.debug(
			`LLM Request: ${config.provider}/${config.model}, ${messages.length} messages, ~${stats.estimatedTokens} tokens (${stats.percentOfContext.toFixed(1)}% of context)`,
		);
	}

	private logLLMResponse(response: any, config: LLMConfig): void {
		if (response.usage) {
			const cost = response.usage.cost
				? ` ($${response.usage.cost.toFixed(6)})`
				: "";
			const cacheInfo = response.usage.cache_read_input_tokens
				? ` [${response.usage.cache_read_input_tokens} cached]`
				: "";
			this.logger.info(
				`Response: ${response.usage.completion_tokens} tokens${cacheInfo}${cost}`,
			);
		}
	}

	private async saveResponseToConversation(
		conversation: Conversation,
		response: { content: string; [key: string]: any },
	): Promise<void> {
		conversation.addAssistantMessage(response.content);

		if (this.storage) {
			await this.storage.saveConversation(conversation.toJSON());
		}
	}

	private createAgentResponse(response: any, config: LLMConfig, messages?: LLMMessage[]): AgentResponse {
		// Extract system prompt and user prompt from messages
		let systemPrompt: string | undefined;
		let userPrompt: string | undefined;
		
		if (messages) {
			// Find system prompt
			const systemMessage = messages.find(msg => msg.role === "system");
			if (systemMessage) {
				systemPrompt = systemMessage.content;
				
				// Add tool information to system prompt if tools are available
				if (this.toolRegistry) {
					const availableTools = this.toolRegistry.getAllTools();
					if (availableTools.length > 0) {
						const toolPrompt = this.toolRegistry.generateSystemPrompt();
						systemPrompt = systemPrompt + '\n\n' + toolPrompt;
					}
				}
			}
			
			// Get the last user message as the user prompt
			const userMessages = messages.filter(msg => msg.role === "user");
			if (userMessages.length > 0) {
				userPrompt = userMessages[userMessages.length - 1].content;
			}
		}
		
		return {
			content: response.content,
			confidence: 0.8, // TODO: Calculate based on response quality
			metadata: {
				model: response.model || config.model,
				provider: config.provider,
				usage: response.usage,
				systemPrompt,
				userPrompt,
			},
		};
	}

	private isCacheControlError(error: any): boolean {
		return error.message?.includes(
			"No endpoints found that support cache control",
		);
	}

	private async handleCacheControlError(
		conversationId: string,
		config: LLMConfig,
		projectPath: string,
		originalConfig?: LLMConfig,
		isFromAgent = false,
		typingIndicatorCallback?: (message: string) => Promise<void>,
	): Promise<AgentResponse> {
		this.logger.warning(
			`Model ${config.model} does not support cache control. Disabling caching for this configuration.`,
		);

		// Disable caching for this specific config
		config.enableCaching = false;

		// Update the llms.json file to persist this change
		const configManager = new LLMConfigManager(projectPath);
		await configManager.disableCachingForConfig(config);

		// Retry the request without caching
		this.logger.info("Retrying request without cache control...");
		return this.generateResponse(
			conversationId,
			config,
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
		const conversationId = this.extractConversationId(event);
		const conversation = await this.getOrCreateConversation(conversationId);

		// Add the event content to conversation
		conversation.addUserMessage(event.content, event);

		// Save updated conversation to storage
		if (this.storage) {
			await this.storage.saveConversation(conversation.toJSON());
		}

		// Generate and return response
		return this.generateResponse(
			conversationId,
			llmConfig,
			projectPath,
			isFromAgent,
		);
	}
}
