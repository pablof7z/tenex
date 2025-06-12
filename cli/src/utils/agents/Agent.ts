import path from "path";
import { type NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import fs from "fs/promises";
import { logger } from "../logger";
import { Conversation } from "./Conversation";
import { ConversationOptimizer } from "./ConversationOptimizer";
import type { ConversationStorage } from "./ConversationStorage";
import { LLMConfigManager } from "./llm/LLMConfigManager";
import { LLMFactory } from "./llm/LLMFactory";
import type { LLMMessage } from "./llm/types";
import type { AgentConfig, AgentResponse, LLMConfig } from "./types";

export class Agent {
	private name: string;
	private nsec: string;
	private signer: NDKPrivateKeySigner;
	private config: AgentConfig;
	private conversations: Map<string, Conversation>;
	private defaultLLMConfig?: LLMConfig;
	private storage?: ConversationStorage;

	constructor(
		name: string,
		nsec: string,
		config: AgentConfig,
		storage?: ConversationStorage,
	) {
		this.name = name;
		this.nsec = nsec;
		this.signer = new NDKPrivateKeySigner(nsec);
		this.config = config;
		this.conversations = new Map();
		this.storage = storage;
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

	getSystemPrompt(additionalRules?: string): string {
		if (this.config.systemPrompt) {
			// If there's a predefined system prompt and additional rules, append them
			if (additionalRules) {
				return `${this.config.systemPrompt}\n\n${additionalRules}`;
			}
			return this.config.systemPrompt;
		}

		const parts: string[] = [];

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
			parts.push("\n" + additionalRules);
		}

		return parts.join("\n");
	}

	async createConversation(
		conversationId: string,
		additionalRules?: string,
	): Promise<Conversation> {
		const systemPrompt = this.getSystemPrompt(additionalRules);
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

		logger.info(
			`Created new conversation ${conversationId} for agent ${this.name}`,
		);
		return conversation;
	}

	getConversation(conversationId: string): Conversation | undefined {
		return this.conversations.get(conversationId);
	}

	async getOrCreateConversation(
		conversationId: string,
		additionalRules?: string,
	): Promise<Conversation> {
		let conversation = this.conversations.get(conversationId);

		if (!conversation && this.storage) {
			// Try to load from storage
			const savedContext = await this.storage.loadConversation(conversationId);
			if (savedContext) {
				conversation = Conversation.fromJSON(savedContext);
				this.conversations.set(conversationId, conversation);
				logger.info(`Loaded conversation ${conversationId} from storage`);
			}
		}

		if (!conversation) {
			conversation = await this.createConversation(
				conversationId,
				additionalRules,
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
		if (eTag && eTag[1]) {
			return eTag[1];
		}

		const rootTag = event.tags.find((tag) => tag[0] === "root");
		if (rootTag && rootTag[1]) {
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
			logger.info(`Loaded agent config for ${name} from ${configPath}`);
		} catch (error) {
			logger.info(`No agent config found for ${name}, using defaults`);
		}

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

				// Override with the cached NDKAgent event configuration
				config = {
					...config,
					description: eventConfig.description || config.description,
					role: eventConfig.role || config.role,
					instructions: eventConfig.instructions || config.instructions,
					systemPrompt: eventConfig.systemPrompt,
					version: eventConfig.version || config.version,
				};
				logger.info(
					`Loaded cached NDKAgent event config for ${name} from ${configFile}`,
				);
			} catch (error) {
				logger.warn(
					`Could not load specified config file ${configFile}: ${error}`,
				);
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
							if (eventConfig.name === name && eventConfig.systemPrompt) {
								// Override with the cached NDKAgent event configuration
								config = {
									...config,
									description: eventConfig.description || config.description,
									role: eventConfig.role || config.role,
									instructions: eventConfig.instructions || config.instructions,
									systemPrompt: eventConfig.systemPrompt,
									version: eventConfig.version || config.version,
								};
								logger.info(
									`Loaded cached NDKAgent event config for ${name} from ${file}`,
								);
								break;
							}
						} catch (err) {
							// Skip files that can't be parsed
						}
					}
				}
			} catch (error) {
				// Directory might not exist or can't be read
				logger.debug(`Could not read agents directory: ${error}`);
			}
		}

		return new Agent(name, nsec, config, storage);
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
		logger.info(`Saved agent config for ${this.name} to ${configPath}`);
	}

	async generateResponse(
		conversationId: string,
		llmConfig?: LLMConfig,
		projectPath?: string,
		isFromAgent = false,
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
			logger.info(
				`Generating response for conversation ${conversationId} using ${config.provider}/${config.model}`,
			);
			const provider = LLMFactory.createProvider(config);
			const response = await provider.generateResponse(messages, config);

			// Log the raw response from the model
			this.logLLMResponse(response, config);

			// Save the response
			await this.saveResponseToConversation(conversation, response);

			// Return structured response
			return this.createAgentResponse(response, config);
		} catch (error: any) {
			// Log detailed error information
			logger.error("\n=== LLM ERROR DEBUG ===");
			logger.error(`Error Type: ${error.constructor.name}`);
			logger.error(`Error Message: ${error.message}`);
			logger.error(`Provider: ${config.provider}`);
			logger.error(`Model: ${config.model}`);
			logger.error(`Caching Enabled: ${config.enableCaching !== false}`);

			if (error.response) {
				logger.error(`\nHTTP Response Status: ${error.response.status}`);
				logger.error(`HTTP Response Text: ${error.response.statusText}`);
			}

			if (error.stack) {
				logger.error(`\nStack Trace:`);
				logger.error(error.stack);
			}
			logger.error("=== END ERROR DEBUG ===\n");

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
			logger.warn(
				`Conversation exceeds context window (${stats.estimatedTokens} tokens, ${stats.percentOfContext.toFixed(1)}% of limit)`,
			);
			messages = ConversationOptimizer.optimizeForContextWindow(
				messages,
				contextWindowSize,
			);
			logger.info(`Optimized conversation to ${messages.length} messages`);
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

		logger.info("\n=== LLM PROMPT DEBUG ===");
		logger.info(`Agent: ${this.name}`);
		logger.info(`Conversation ID: ${conversationId}`);
		logger.info(`Provider: ${config.provider}`);
		logger.info(`Model: ${config.model}`);
		logger.info(`Temperature: ${config.temperature ?? 0.7}`);
		logger.info(`Max Tokens: ${config.maxTokens || 4096}`);
		logger.info(`Context Window: ${contextWindowSize}`);
		logger.info(`Caching Enabled: ${config.enableCaching !== false}`);
		logger.info(`\nConversation Stats:`);
		logger.info(`  Total Messages: ${conversation.getMessageCount()}`);
		logger.info(`  Optimized Messages: ${messages.length}`);
		logger.info(`  Estimated Tokens: ${stats.estimatedTokens}`);
		logger.info(`  Context Usage: ${stats.percentOfContext.toFixed(1)}%`);
		logger.info("\nMessages being sent:");
		messages.forEach((msg, index) => {
			logger.info(`\n[${index}] Role: ${msg.role}`);
			if (msg.role === "system") {
				logger.info(`System Prompt:\n${msg.content}`);
			} else {
				logger.info(
					`Content: ${msg.content.slice(0, 300)}${msg.content.length > 300 ? "..." : ""}`,
				);
			}
		});
		logger.info("=== END PROMPT DEBUG ===\n");
	}

	private logLLMResponse(response: any, config: LLMConfig): void {
		logger.info("\n=== LLM RESPONSE DEBUG ===");
		logger.info(`Provider: ${config.provider}`);
		logger.info(`Model: ${response.model || config.model}`);

		// Log the full response content
		logger.info(`\nFull Response Content:`);
		logger.info("------------------------");
		logger.info(response.content);
		logger.info("------------------------");

		// Log usage information if available
		if (response.usage) {
			logger.info(`\nToken Usage:`);
			logger.info(`  Prompt Tokens: ${response.usage.prompt_tokens}`);
			logger.info(`  Completion Tokens: ${response.usage.completion_tokens}`);
			logger.info(`  Total Tokens: ${response.usage.total_tokens}`);

			if (response.usage.cache_creation_input_tokens !== undefined) {
				logger.info(
					`  Cache Creation Tokens: ${response.usage.cache_creation_input_tokens}`,
				);
			}
			if (response.usage.cache_read_input_tokens !== undefined) {
				logger.info(
					`  Cache Read Tokens: ${response.usage.cache_read_input_tokens}`,
				);
			}

			// Log cost information
			if (response.usage.cost !== undefined) {
				logger.info(`  Cost: $${response.usage.cost.toFixed(6)} USD`);
			}
		}

		// Log any additional metadata
		const additionalKeys = Object.keys(response).filter(
			(key) => !["content", "model", "usage"].includes(key),
		);

		if (additionalKeys.length > 0) {
			logger.info(`\nAdditional Response Data:`);
			additionalKeys.forEach((key) => {
				logger.info(`  ${key}: ${JSON.stringify(response[key])}`);
			});
		}

		logger.info("=== END RESPONSE DEBUG ===\n");
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

	private createAgentResponse(response: any, config: LLMConfig): AgentResponse {
		return {
			content: response.content,
			confidence: 0.8, // TODO: Calculate based on response quality
			metadata: {
				model: response.model || config.model,
				provider: config.provider,
				usage: response.usage,
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
	): Promise<AgentResponse> {
		logger.warn(
			`Model ${config.model} does not support cache control. Disabling caching for this configuration.`,
		);

		// Disable caching for this specific config
		config.enableCaching = false;

		// Update the llms.json file to persist this change
		const configManager = new LLMConfigManager(projectPath);
		await configManager.disableCachingForConfig(config);

		// Retry the request without caching
		logger.info(`Retrying request without cache control...`);
		return this.generateResponse(
			conversationId,
			config,
			projectPath,
			isFromAgent,
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
