import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
	type NDK,
	type NDKEvent,
	NDKEvent as NDKEventClass,
	NDKPrivateKeySigner,
} from "@nostr-dev-kit/ndk";
import type { ProjectInfo } from "../../commands/run/ProjectLoader";
import { getAgentSigner } from "../agentManager";
import { logger } from "../logger";
import { Agent } from "./Agent";
import { ConversationStorage } from "./ConversationStorage";
import type { AgentResponse, LLMConfig } from "./types";
import { ToolRegistry } from "./tools/ToolRegistry";
import { exampleTools } from "./tools/examples";
import { claudeCodeTool } from "./tools/claudeCode";
import { rememberLessonTool } from "./tools/rememberLesson";
import { updateSpecTool } from "./tools/updateSpec";
import { readSpecsTool } from "./tools/readSpecs";

interface LLMConfigs {
	default?: string;
	[key: string]: any;
}

interface AgentConfigEntry {
	nsec: string;
	file?: string;
}

interface AgentsConfig {
	[key: string]: string | AgentConfigEntry; // agent name -> nsec (old format) or config object (new format)
}

export class AgentManager {
	private projectPath: string;
	private agents: Map<string, Agent>;
	private llmConfigs: Map<string, LLMConfig>;
	private defaultLLM?: string;
	private conversationStorage: ConversationStorage;
	private projectInfo?: ProjectInfo;
	private toolRegistry: ToolRegistry;
	private ndk?: NDK;

	constructor(projectPath: string, projectInfo?: ProjectInfo) {
		this.projectPath = projectPath;
		this.projectInfo = projectInfo;
		this.agents = new Map();
		this.llmConfigs = new Map();
		this.conversationStorage = new ConversationStorage(projectPath);
		this.toolRegistry = new ToolRegistry();

		// Register default tools
		this.registerDefaultTools();
	}

	setNDK(ndk: NDK): void {
		this.ndk = ndk;
	}

	private registerDefaultTools(): void {
		// Register Claude Code tool first (highest priority)
		this.toolRegistry.register(claudeCodeTool);

		// Register spec tools
		this.toolRegistry.register(updateSpecTool);
		this.toolRegistry.register(readSpecsTool);

		// Register example tools
		// In production, you might want to make this configurable
		for (const tool of exampleTools) {
			this.toolRegistry.register(tool);
		}
	}

	async initialize(): Promise<void> {
		// Initialize conversation storage
		await this.conversationStorage.initialize();

		// Load LLM configurations
		await this.loadLLMConfigs();

		// Load agent configurations
		await this.loadAgents();

		// Clean up old conversations (older than 30 days)
		await this.conversationStorage.cleanupOldConversations();
		logger.info("Cleaned up old conversations");
	}

	private async loadLLMConfigs(): Promise<void> {
		const llmsPath = path.join(this.projectPath, ".tenex", "llms.json");

		try {
			const content = await fs.readFile(llmsPath, "utf-8");
			const configs: LLMConfigs = JSON.parse(content);

			// Handle two possible structures:
			// 1. { "default": "configName", "configName": {...} }
			// 2. { "default": {...} }
			if (configs.default) {
				if (typeof configs.default === "string") {
					// Case 1: default is a reference to another config
					this.defaultLLM = configs.default;
				} else if (typeof configs.default === "object") {
					// Case 2: default is the actual config
					this.defaultLLM = "default";
					this.llmConfigs.set("default", configs.default as LLMConfig);
					logger.info("Loaded LLM config: default");
				}
			}

			// Load all configs (both objects and string references)
			for (const [name, config] of Object.entries(configs)) {
				if (typeof config === "object") {
					// It's an actual config object
					this.llmConfigs.set(name, config as LLMConfig);
					logger.info(`Loaded LLM config: ${name}`);
				} else if (typeof config === "string" && name !== "default") {
					// It's a reference - we'll resolve it later in getLLMConfig
					logger.info(`Found LLM config reference: ${name} -> ${config}`);
				}
			}

			if (this.defaultLLM) {
				logger.info(`Default LLM config name: ${this.defaultLLM}`);
				const defaultConfig = this.resolveLLMConfig(this.defaultLLM);
				if (defaultConfig) {
					logger.info(
						`Default LLM provider: ${defaultConfig.provider}, model: ${defaultConfig.model}`,
					);
				}
			}
		} catch (error) {
			logger.warn("No llms.json found or failed to load:", error);
		}
	}

	private async loadAgents(): Promise<void> {
		const agentsPath = path.join(this.projectPath, ".tenex", "agents.json");

		try {
			const content = await fs.readFile(agentsPath, "utf-8");
			const agentsConfig: AgentsConfig = JSON.parse(content);

			for (const [name, configOrNsec] of Object.entries(agentsConfig)) {
				let nsec: string;
				let configFile: string | undefined;

				// Handle both old format (string) and new format (object)
				if (typeof configOrNsec === "string") {
					// Old format: just nsec string
					nsec = configOrNsec;
				} else {
					// New format: object with nsec and optional file
					nsec = configOrNsec.nsec;
					configFile = configOrNsec.file;
				}

				// Create agent-specific tool registry
				const agentToolRegistry = new ToolRegistry();
				
				// Copy all tools from the main registry
				for (const tool of this.toolRegistry.getAllTools()) {
					agentToolRegistry.register(tool);
				}

				const agent = await Agent.loadFromConfig(
					name,
					nsec,
					this.projectPath,
					this.conversationStorage,
					configFile,
					this.projectInfo?.title || "unknown",
					agentToolRegistry,
				);

				// Set agent-specific LLM config or fall back to default
				const llmConfig = this.getLLMConfigForAgent(name);
				if (llmConfig) {
					agent.setDefaultLLMConfig(llmConfig);
				}

				// Set NDK if available
				if (this.ndk) {
					agent.setNDK(this.ndk);
				}

				// Set agent manager reference
				agent.setAgentManager(this);

				this.agents.set(name, agent);

				// Register remember_lesson tool if agent has an event ID
				if (agent.getAgentEventId() && this.ndk) {
					agentToolRegistry.register(rememberLessonTool);
					// Update the agent with the new tool registry
					agent.setToolRegistry(agentToolRegistry);
				}
				// Agent will log its own creation with project-specific logger
			}
		} catch (error: any) {
			logger.warn(`No agents.json found or failed to load: ${error.message}`);
		}
	}

	async getAgent(name = "default"): Promise<Agent> {
		let agent = this.agents.get(name);

		if (!agent) {
			// Create new agent if it doesn't exist
			// Agent will log its own creation with project-specific logger
			const { nsec, configFile } = await getAgentSigner(this.projectPath, name);

			// Create agent-specific tool registry
			const agentToolRegistry = new ToolRegistry();
			
			// Copy all tools from the main registry
			for (const tool of this.toolRegistry.getAllTools()) {
				agentToolRegistry.register(tool);
			}

			agent = await Agent.loadFromConfig(
				name,
				nsec,
				this.projectPath,
				this.conversationStorage,
				configFile,
				this.projectInfo?.title || "unknown",
				agentToolRegistry,
			);

			// Set agent-specific LLM config or fall back to default
			const llmConfig = this.getLLMConfigForAgent(name);
			if (llmConfig) {
				agent.setDefaultLLMConfig(llmConfig);
			}

			// Set NDK if available
			if (this.ndk) {
				agent.setNDK(this.ndk);
			}

			// Set agent manager reference
			agent.setAgentManager(this);

			this.agents.set(name, agent);

			// Register remember_lesson tool if agent has an event ID
			if (agent.getAgentEventId() && this.ndk) {
				agentToolRegistry.register(rememberLessonTool);
				// Update the agent with the new tool registry
				agent.setToolRegistry(agentToolRegistry);
			}
		}

		return agent;
	}

	getLLMConfig(name?: string): LLMConfig | undefined {
		// If a specific name is requested, resolve it (handling references)
		if (name) {
			return this.resolveLLMConfig(name);
		}

		// Otherwise use default
		if (this.defaultLLM) {
			return this.resolveLLMConfig(this.defaultLLM);
		}

		// Return first available config
		return this.llmConfigs.values().next().value;
	}

	private resolveLLMConfig(
		name: string,
		visited: Set<string> = new Set(),
	): LLMConfig | undefined {
		// Check for circular references
		if (visited.has(name)) {
			logger.warn(`Circular reference detected in LLM config: ${name}`);
			return undefined;
		}
		visited.add(name);

		const config = this.llmConfigs.get(name);

		// If config not found, check in raw llms.json for string references
		if (!config) {
			const llmsPath = path.join(this.projectPath, ".tenex", "llms.json");
			try {
				const content = readFileSync(llmsPath, "utf-8");
				const configs = JSON.parse(content);
				const rawConfig = configs[name];

				if (typeof rawConfig === "string") {
					// It's a reference to another config
					logger.info(`Config '${name}' references '${rawConfig}'`);
					return this.resolveLLMConfig(rawConfig, visited);
				}
			} catch (error) {
				// Ignore errors, config not found
			}
			return undefined;
		}

		return config;
	}

	getLLMConfigForAgent(agentName: string): LLMConfig | undefined {
		// First try agent-specific config
		const agentConfig = this.resolveLLMConfig(agentName);
		if (agentConfig) {
			// Don't log this - it's not a warning condition
			return agentConfig;
		}

		// Fall back to default
		return this.getLLMConfig();
	}

	getAllAgents(): Map<string, Agent> {
		return new Map(this.agents);
	}

	async getAgentByPubkey(pubkey: string): Promise<Agent | undefined> {
		// Check loaded agents first
		for (const agent of this.agents.values()) {
			if (agent.getPubkey() === pubkey) {
				return agent;
			}
		}

		// Check agents.json for agents not yet loaded
		const agentsPath = path.join(this.projectPath, ".tenex", "agents.json");
		try {
			const content = await fs.readFile(agentsPath, "utf-8");
			const agentsConfig: AgentsConfig = JSON.parse(content);

			for (const [name, configOrNsec] of Object.entries(agentsConfig)) {
				let nsec: string;

				// Handle both old format (string) and new format (object)
				if (typeof configOrNsec === "string") {
					nsec = configOrNsec;
				} else {
					nsec = configOrNsec.nsec;
				}

				const signer = new NDKPrivateKeySigner(nsec);
				if (signer.pubkey === pubkey) {
					// Load and return this agent
					return await this.getAgent(name);
				}
			}
		} catch (error) {
			logger.warn("Failed to check agents.json for pubkey lookup");
		}

		return undefined;
	}

	getAllLLMConfigs(): Map<string, LLMConfig> {
		return new Map(this.llmConfigs);
	}

	getProjectPath(): string {
		return this.projectPath;
	}

	getConversationStorage(): ConversationStorage {
		return this.conversationStorage;
	}

	getToolRegistry(): ToolRegistry {
		return this.toolRegistry;
	}

	registerTool(tool: import("./tools/types").ToolDefinition): void {
		this.toolRegistry.register(tool);
		// Update all existing agents with the new tool registry
		for (const agent of this.agents.values()) {
			agent.setToolRegistry(this.toolRegistry);
		}
	}

	unregisterTool(toolName: string): void {
		this.toolRegistry.unregister(toolName);
		// Update all existing agents with the updated tool registry
		for (const agent of this.agents.values()) {
			agent.setToolRegistry(this.toolRegistry);
		}
	}

	private extractConversationId(event: NDKEvent): string {
		// Same logic as in Agent.extractConversationId
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

	async isEventFromAnyAgent(eventPubkey: string): Promise<boolean> {
		// Note: This method checks if event is from ANY agent in the project
		// Currently not used - we only check for self-events to allow agent-to-agent conversation

		// Check if the event is from any of the loaded agents
		for (const agent of this.agents.values()) {
			if (agent.getPubkey() === eventPubkey) {
				return true;
			}
		}

		// Also check agents that might not be loaded yet from agents.json
		const agentsPath = path.join(this.projectPath, ".tenex", "agents.json");
		try {
			const content = await fs.readFile(agentsPath, "utf-8");
			const agentsConfig: AgentsConfig = JSON.parse(content);

			for (const [name, configOrNsec] of Object.entries(agentsConfig)) {
				let nsec: string;

				// Handle both old format (string) and new format (object)
				if (typeof configOrNsec === "string") {
					nsec = configOrNsec;
				} else {
					nsec = configOrNsec.nsec;
				}

				// Create a temporary signer to get the pubkey
				const signer = new NDKPrivateKeySigner(nsec);
				if (signer.pubkey === eventPubkey) {
					logger.info(
						`Event is from agent '${name}' (pubkey: ${eventPubkey.slice(0, 8)}...)`,
					);
					return true;
				}
			}
		} catch (error) {
			logger.warn("Failed to check agents.json for pubkey comparison");
		}

		return false;
	}

	async handleChatEvent(
		event: NDKEvent,
		ndk: NDK,
		agentName = "default",
		llmName?: string,
		mentionedPubkeys: string[] = [],
	): Promise<void> {
		try {
			// Check if we've already processed this event
			if (this.conversationStorage.isEventProcessed(event.id)) {
				logger.info(`Skipping already processed chat event ${event.id}`);
				return;
			}

			// Extract conversation ID
			const conversationId = this.extractConversationId(event);

			// First, add this event to ALL agents' conversation history for context tracking
			// This ensures all agents have full context even if they don't respond
			for (const [name, agent] of this.agents) {
				// Skip if this is the agent's own message
				if (agent.getPubkey() === event.author.pubkey) {
					logger.debug(`Skipping adding event to ${name}'s own conversation`);
					continue;
				}

				// Get rules for this agent if projectInfo is available
				let agentRules: string | undefined;
				if (this.projectInfo?.rulesManager && this.projectInfo?.ruleMappings) {
					const rules = this.projectInfo.rulesManager.getRulesForAgent(
						name,
						this.projectInfo.ruleMappings,
					);
					agentRules =
						this.projectInfo.rulesManager.formatRulesForPrompt(rules);
				}

				// Add available agents information to the rules
				const agentsInfo = await this.formatAvailableAgentsForPrompt(name);
				const combinedRules = agentRules
					? `${agentRules}${agentsInfo}`
					: agentsInfo || undefined;

				// Generate environment context
				const environmentContext = this.generateEnvironmentContext(name);

				const conversation = await agent.getOrCreateConversation(
					conversationId,
					combinedRules,
					environmentContext,
				);
				conversation.addUserMessage(event.content, event);

				// Save the conversation to persist the context
				await this.conversationStorage.saveConversation(conversation.toJSON());
				logger.debug(
					`Added event to ${name} agent's conversation history for context`,
				);
			}

			// Check if the event is from another agent
			const isFromAgent = await this.isEventFromAnyAgent(event.author.pubkey);

			// Check if any agents are already part of this conversation
			const participatingAgents: Agent[] = [];
			for (const [name, agent] of this.agents) {
				const conversation = agent.getConversation(conversationId);
				if (conversation?.isParticipant(agent.getPubkey())) {
					participatingAgents.push(agent);
				}
			}

			// Determine which agents should respond
			const agentsToRespond: Agent[] = [];

			// First, add any newly p-tagged agents
			if (mentionedPubkeys.length > 0) {
				for (const pubkey of mentionedPubkeys) {
					const mentionedAgent = await this.getAgentByPubkey(pubkey);
					if (
						mentionedAgent &&
						mentionedAgent.getPubkey() !== event.author.pubkey
					) {
						agentsToRespond.push(mentionedAgent);
						logger.info(
							`Agent '${mentionedAgent.getName()}' was p-tagged and will join the conversation`,
						);
					}
				}
			}

			// If this is from an agent and no one was explicitly p-tagged, no one should respond
			if (isFromAgent && mentionedPubkeys.length === 0) {
				logger.info(
					`Event is from an agent with no p-tags. No agents will respond to avoid unnecessary chatter.`,
				);
				return;
			}

			// Then, add any existing conversation participants (only if event is not from an agent)
			if (!isFromAgent) {
				for (const agent of participatingAgents) {
					if (
						!agentsToRespond.find((a) => a.getName() === agent.getName()) &&
						agent.getPubkey() !== event.author.pubkey
					) {
						agentsToRespond.push(agent);
						logger.info(
							`Agent '${agent.getName()}' is already in the conversation and will respond`,
						);
					}
				}
			}

			// If no agents selected yet and event is not from an agent, use the default agent
			if (agentsToRespond.length === 0 && !isFromAgent) {
				const defaultAgent = await this.getAgent(agentName);

				if (defaultAgent.getPubkey() === event.author.pubkey) {
					logger.info(
						`Skipping chat event from agent '${agentName}' itself: ${event.id}`,
					);
					return;
				}

				agentsToRespond.push(defaultAgent);
			}

			const llmConfig = this.getLLMConfig(llmName);

			if (!llmConfig) {
				logger.error("No LLM configuration available for chat response");
				logger.error(`Requested LLM: ${llmName || "default"}`);
				logger.error(
					`Available LLMs: ${Array.from(this.llmConfigs.keys()).join(", ")}`,
				);
				logger.error(`Default LLM name: ${this.defaultLLM}`);
				return;
			}

			// Have each agent respond to the event
			for (const agent of agentsToRespond) {
				try {

					// Get agent-specific LLM config if available
					const agentLLMConfig =
						this.getLLMConfigForAgent(agent.getName()) || llmConfig;

					// Extract system prompt and last message from conversation  
					const conversation = agent.getConversation(conversationId);
					let systemPrompt: string | undefined;
					let lastUserMessage: string | undefined;
					
					if (conversation) {
						const messages = conversation.getFormattedMessages();
						// Find system prompt
						const systemMessage = messages.find(msg => msg.role === "system");
						if (systemMessage) {
							systemPrompt = systemMessage.content;
							
							// Add tool information to system prompt if tools are available
							const toolRegistry = agent.getToolRegistry();
							if (toolRegistry) {
								const availableTools = toolRegistry.getAllTools();
								if (availableTools.length > 0) {
									const toolPrompt = toolRegistry.generateSystemPrompt();
									systemPrompt = systemPrompt + '\n\n' + toolPrompt;
								}
							}
						}
						// Get the last user message (which should be the current event)
						const userMessages = messages.filter(msg => msg.role === "user");
						if (userMessages.length > 0) {
							lastUserMessage = userMessages[userMessages.length - 1].content;
						}
					}

					// Publish typing indicator with system prompt and user prompt
					await this.publishTypingIndicator(ndk, event, agent, true, undefined, systemPrompt, lastUserMessage);

					// Create typing indicator callback
					const typingIndicatorCallback = async (message: string) => {
						await this.publishTypingIndicator(ndk, event, agent, true, message, systemPrompt, lastUserMessage);
					};

					// Generate response (the event is already in conversation history)
					const response = await agent.generateResponse(
						conversationId,
						agentLLMConfig,
						this.projectPath,
						isFromAgent,
						typingIndicatorCallback,
					);

					// Only publish if agent has something meaningful to say
					if (
						!response.content.toLowerCase().includes("nothing to add") &&
						response.content.trim().length > 0
					) {
						// Add agent as participant in conversation
						const conversationId = this.extractConversationId(event);
						const conversation = agent.getConversation(conversationId);
						if (conversation) {
							conversation.addParticipant(agent.getPubkey());
							await this.conversationStorage.saveConversation(
								conversation.toJSON(),
							);
						}

						// Publish response to Nostr
						await this.publishResponse(ndk, event, response, agent);
						logger.info(
							`Chat response generated and published by agent '${agent.getName()}'`,
						);

						// Stop typing indicator after publishing response
						await this.publishTypingIndicator(ndk, event, agent, false, undefined, undefined, undefined);
					} else {
						logger.info(
							`Agent '${agent.getName()}' had nothing to add to the conversation`,
						);

						// Stop typing indicator since agent decided not to respond
						await this.publishTypingIndicator(ndk, event, agent, false, undefined, undefined, undefined);
					}
				} catch (error) {
					logger.error(
						`Failed to generate response for agent '${agent.getName()}': ${error}`,
					);

					// Stop typing indicator on error
					try {
						await this.publishTypingIndicator(ndk, event, agent, false, undefined, undefined, undefined);
					} catch (indicatorError) {
						logger.error(`Failed to stop typing indicator: ${indicatorError}`);
					}
				}
			}

			// Mark event as processed only after all agents have responded
			await this.conversationStorage.markEventProcessed(
				event.id,
				event.created_at || Date.now() / 1000,
			);
		} catch (error) {
			logger.error(`Failed to handle chat event: ${error}`);
			logger.error(
				`Error details: ${error instanceof Error ? error.stack : String(error)}`,
			);
			logger.error(`Event ID: ${event.id}`);
			logger.error(`Event content preview: ${event.content?.slice(0, 100)}...`);
		}
	}

	async handleTaskEvent(
		event: NDKEvent,
		ndk: NDK,
		agentName = "default",
		llmName?: string,
		mentionedPubkeys: string[] = [],
	): Promise<void> {
		try {
			// Check if we've already processed this event
			if (this.conversationStorage.isEventProcessed(event.id)) {
				logger.info(`Skipping already processed task event ${event.id}`);
				return;
			}

			const taskId = event.id;

			// Extract task details
			const titleTag = event.tags.find((tag) => tag[0] === "title");
			const title = titleTag ? titleTag[1] : "Untitled Task";
			const taskContent = `Task: ${title}\n\nDescription:\n${event.content}`;

			// First, add this task to ALL agents' conversation history for context tracking
			// This ensures all agents have full context even if they don't respond
			for (const [name, agent] of this.agents) {
				// Skip if this is the agent's own message
				if (agent.getPubkey() === event.author.pubkey) {
					continue;
				}

				// Get rules for this agent if projectInfo is available
				let agentRules: string | undefined;
				if (this.projectInfo?.rulesManager && this.projectInfo?.ruleMappings) {
					const rules = this.projectInfo.rulesManager.getRulesForAgent(
						name,
						this.projectInfo.ruleMappings,
					);
					agentRules =
						this.projectInfo.rulesManager.formatRulesForPrompt(rules);
				}

				// Add available agents information to the rules
				const agentsInfo = await this.formatAvailableAgentsForPrompt(name);
				const combinedRules = agentRules
					? `${agentRules}${agentsInfo}`
					: agentsInfo || undefined;

				// Generate environment context
				const environmentContext = this.generateEnvironmentContext(name);

				const conversation = await agent.getOrCreateConversation(
					taskId,
					combinedRules,
					environmentContext,
				);
				conversation.addUserMessage(taskContent, event);
				conversation.setMetadata("taskId", taskId);
				conversation.setMetadata("taskTitle", title);

				// Save the conversation to persist the context
				await this.conversationStorage.saveConversation(conversation.toJSON());
				logger.debug(
					`Added task to ${name} agent's conversation history for context`,
				);
			}

			// Check if the event is from another agent
			const isFromAgent = await this.isEventFromAnyAgent(event.author.pubkey);

			// Check if any agents are already part of this task conversation
			const participatingAgents: Agent[] = [];
			for (const [name, agent] of this.agents) {
				const conversation = agent.getConversation(taskId);
				if (conversation?.isParticipant(agent.getPubkey())) {
					participatingAgents.push(agent);
				}
			}

			// Determine which agents should respond
			const agentsToRespond: Agent[] = [];

			// First, add any newly p-tagged agents
			if (mentionedPubkeys.length > 0) {
				for (const pubkey of mentionedPubkeys) {
					const mentionedAgent = await this.getAgentByPubkey(pubkey);
					if (
						mentionedAgent &&
						mentionedAgent.getPubkey() !== event.author.pubkey
					) {
						agentsToRespond.push(mentionedAgent);
						logger.info(
							`Agent '${mentionedAgent.getName()}' was p-tagged for task and will respond`,
						);
					}
				}
			}

			// If this is from an agent and no one was explicitly p-tagged, no one should respond
			if (isFromAgent && mentionedPubkeys.length === 0) {
				logger.info(
					`Task event is from an agent with no p-tags. No agents will respond to avoid unnecessary chatter.`,
				);
				return;
			}

			// Then, add any existing task participants (only if event is not from an agent)
			if (!isFromAgent) {
				for (const agent of participatingAgents) {
					if (
						!agentsToRespond.find((a) => a.getName() === agent.getName()) &&
						agent.getPubkey() !== event.author.pubkey
					) {
						agentsToRespond.push(agent);
						logger.info(
							`Agent '${agent.getName()}' is already on the task and will respond`,
						);
					}
				}
			}

			// If no agents selected yet and event is not from an agent, use the default agent
			if (agentsToRespond.length === 0 && !isFromAgent) {
				const defaultAgent = await this.getAgent(agentName);

				if (defaultAgent.getPubkey() === event.author.pubkey) {
					logger.info(
						`Skipping task event from agent '${agentName}' itself: ${event.id}`,
					);
					return;
				}

				agentsToRespond.push(defaultAgent);
			}

			const llmConfig = this.getLLMConfig(llmName);
			if (!llmConfig) {
				logger.error("No LLM configuration available for task response");
				logger.error(`Requested LLM: ${llmName || "default"}`);
				logger.error(
					`Available LLMs: ${Array.from(this.llmConfigs.keys()).join(", ")}`,
				);
				logger.error(`Default LLM name: ${this.defaultLLM}`);
				return;
			}

			// Have each agent respond to the task
			for (const agent of agentsToRespond) {
				try {
					// Get conversation (already has the task in it from above)
					const conversation = agent.getConversation(taskId);
					if (!conversation) {
						logger.error(
							`Conversation ${taskId} not found for agent ${agent.getName()}`,
						);
						continue;
					}

					// Add agent as participant
					conversation.addParticipant(agent.getPubkey());

					// Save conversation with participant update
					await this.conversationStorage.saveConversation(
						conversation.toJSON(),
					);

					// Get agent-specific LLM config if available
					const agentLLMConfig =
						this.getLLMConfigForAgent(agent.getName()) || llmConfig;

					// Extract system prompt and last message from conversation  
					// Note: In handleTaskEvent, conversation is already defined above
					let systemPrompt: string | undefined;
					let lastUserMessage: string | undefined;
					
					if (conversation) {
						const messages = conversation.getFormattedMessages();
						// Find system prompt
						const systemMessage = messages.find(msg => msg.role === "system");
						if (systemMessage) {
							systemPrompt = systemMessage.content;
							
							// Add tool information to system prompt if tools are available
							const toolRegistry = agent.getToolRegistry();
							if (toolRegistry) {
								const availableTools = toolRegistry.getAllTools();
								if (availableTools.length > 0) {
									const toolPrompt = toolRegistry.generateSystemPrompt();
									systemPrompt = systemPrompt + '\n\n' + toolPrompt;
								}
							}
						}
						// Get the last user message (which should be the current event)
						const userMessages = messages.filter(msg => msg.role === "user");
						if (userMessages.length > 0) {
							lastUserMessage = userMessages[userMessages.length - 1].content;
						}
					}

					// Publish typing indicator with system prompt and user prompt
					await this.publishTypingIndicator(ndk, event, agent, true, undefined, systemPrompt, lastUserMessage);

					// Create typing indicator callback
					const typingIndicatorCallback = async (message: string) => {
						await this.publishTypingIndicator(ndk, event, agent, true, message, systemPrompt, lastUserMessage);
					};

					// Generate response (task is already in conversation history)
					const response = await agent.generateResponse(
						taskId,
						agentLLMConfig,
						this.projectPath,
						isFromAgent,
						typingIndicatorCallback,
					);

					// Only publish if agent has something meaningful to say
					if (
						!response.content.toLowerCase().includes("nothing to add") &&
						response.content.trim().length > 0
					) {
						// Publish status update
						await this.publishTaskStatus(ndk, event, response, agent);
						logger.info(
							`Task '${title}' response generated by agent '${agent.getName()}'`,
						);

						// Stop typing indicator after publishing response
						await this.publishTypingIndicator(ndk, event, agent, false, undefined, undefined, undefined);
					} else {
						logger.info(
							`Agent '${agent.getName()}' had nothing to add to task '${title}'`,
						);

						// Stop typing indicator since agent decided not to respond
						await this.publishTypingIndicator(ndk, event, agent, false, undefined, undefined, undefined);
					}
				} catch (error) {
					logger.error(
						`Failed to generate task response for agent '${agent.getName()}': ${error}`,
					);

					// Stop typing indicator on error
					try {
						await this.publishTypingIndicator(ndk, event, agent, false, undefined, undefined, undefined);
					} catch (indicatorError) {
						logger.error(`Failed to stop typing indicator: ${indicatorError}`);
					}
				}
			}

			// Mark event as processed only after all agents have responded
			await this.conversationStorage.markEventProcessed(
				event.id,
				event.created_at || Date.now() / 1000,
			);
		} catch (error) {
			logger.error(`Failed to handle task event: ${error}`);
			logger.error(
				`Error details: ${error instanceof Error ? error.stack : String(error)}`,
			);
			logger.error(`Event ID: ${event.id}`);
			logger.error(
				`Task title: ${event.tags.find((tag) => tag[0] === "title")?.[1] || "Unknown"}`,
			);
		}
	}

	private async publishTypingIndicator(
		ndk: NDK,
		threadEvent: NDKEvent,
		agent: Agent,
		isTyping: boolean,
		customMessage?: string,
		systemPrompt?: string,
		prompt?: string,
	): Promise<void> {
		try {
			const indicatorEvent = new NDKEventClass(ndk);
			indicatorEvent.kind = isTyping ? 24111 : 24112;

			// e-tag the thread
			const conversationId = this.extractConversationId(threadEvent);
			indicatorEvent.tags.push(["e", conversationId]);

			// Add project reference if exists
			const aTag = threadEvent.tags.find((tag) => tag[0] === "a");
			if (aTag) {
				indicatorEvent.tags.push(aTag);
			}

			// Add system prompt and prompt tags if provided
			if (isTyping && systemPrompt) {
				indicatorEvent.tags.push(["system-prompt", systemPrompt]);
			}
			if (isTyping && prompt) {
				indicatorEvent.tags.push(["prompt", prompt]);
			}

			// Set content for typing indicator
			if (isTyping) {
				indicatorEvent.content =
					customMessage || `[${agent.getName()}] is typing...`;
			} else {
				indicatorEvent.content = "";
			}

			// Sign with agent's signer
			await indicatorEvent.sign(agent.getSigner());
			await indicatorEvent.publish();

			logger.debug(
				`Published ${isTyping ? "typing" : "stop typing"} indicator for ${agent.getName()}`,
			);
		} catch (error) {
			logger.error(`Failed to publish typing indicator: ${error}`);
		}
	}

	private async publishResponse(
		ndk: NDK,
		originalEvent: NDKEvent,
		response: AgentResponse,
		agent: Agent,
	): Promise<void> {
		try {
			const replyEvent = originalEvent.reply();
			replyEvent.content = response.content;

			// Add conversation root if exists
			const aTag = originalEvent.tags.find((tag) => tag[0] === "a");
			if (aTag) {
				replyEvent.tags.push(aTag);
			}

			// Preserve p-tags from original event to maintain conversation participants
			const originalPTags = originalEvent.tags.filter((tag) => tag[0] === "p");
			for (const pTag of originalPTags) {
				// Don't duplicate p-tags that are already in the reply
				const existingPTag = replyEvent.tags.find(
					(tag) => tag[0] === "p" && tag[1] === pTag[1],
				);
				if (!existingPTag && pTag[1] !== agent.getPubkey()) {
					replyEvent.tags.push(pTag);
				}
			}

			// Add LLM metadata tags
			if (response.metadata) {
				// Add model tag
				if (response.metadata.model) {
					replyEvent.tags.push(["llm-model", response.metadata.model]);
				}

				// Add provider tag
				if (response.metadata.provider) {
					replyEvent.tags.push(["llm-provider", response.metadata.provider]);
				}

				// Add usage metadata
				if (response.metadata.usage) {
					const usage = response.metadata.usage;
					replyEvent.tags.push([
						"llm-prompt-tokens",
						String(usage.prompt_tokens),
					]);
					replyEvent.tags.push([
						"llm-completion-tokens",
						String(usage.completion_tokens),
					]);
					replyEvent.tags.push([
						"llm-total-tokens",
						String(usage.total_tokens),
					]);

					// Add cache information if available
					if (usage.cache_creation_input_tokens !== undefined) {
						replyEvent.tags.push([
							"llm-cache-creation-tokens",
							String(usage.cache_creation_input_tokens),
						]);
					}
					if (usage.cache_read_input_tokens !== undefined) {
						replyEvent.tags.push([
							"llm-cache-read-tokens",
							String(usage.cache_read_input_tokens),
						]);
					}

					// Add cost information if available
					if (usage.cost !== undefined) {
						replyEvent.tags.push(["llm-cost", String(usage.cost)]);
						replyEvent.tags.push(["llm-cost-usd", usage.cost.toFixed(6)]);
					}
				}

				// Add confidence if available
				if (response.confidence !== undefined) {
					replyEvent.tags.push(["llm-confidence", String(response.confidence)]);
				}
				
				// Add system prompt if available
				if (response.metadata.systemPrompt) {
					replyEvent.tags.push([
						"llm-system-prompt",
						response.metadata.systemPrompt,
					]);
				}
				
				// Add user prompt if available
				if (response.metadata.userPrompt) {
					replyEvent.tags.push([
						"llm-user-prompt",
						response.metadata.userPrompt,
					]);
				}
			}

			// Sign with agent's signer
			await replyEvent.sign(agent.getSigner());
			replyEvent.publish();

			logger.info(`Published response to event ${originalEvent.id}`);
			logger.debug(`Reply event ID: ${replyEvent.id}`);
			logger.debug(
				`Reply content preview: ${replyEvent.content.slice(0, 100)}...`,
			);
			// Use rawEvent() which returns a plain object without circular references
			const rawEvent = replyEvent.rawEvent();
			logger.debug(`Reply event raw: ${JSON.stringify(rawEvent, null, 2)}`);
		} catch (error) {
			logger.error(`Failed to publish response: ${error}`);
		}
	}

	private async publishTaskStatus(
		ndk: NDK,
		taskEvent: NDKEvent,
		response: AgentResponse,
		agent: Agent,
	): Promise<void> {
		try {
			const statusEvent = taskEvent.reply();
			statusEvent.content = response.content;

			// Add project reference if exists
			const projectTag = taskEvent.tags.find((tag) => tag[0] === "a");
			if (projectTag) {
				statusEvent.tags.push(projectTag);
			}

			// Preserve p-tags from original event to maintain conversation participants
			const originalPTags = taskEvent.tags.filter((tag) => tag[0] === "p");
			for (const pTag of originalPTags) {
				// Don't duplicate p-tags that are already in the reply
				const existingPTag = statusEvent.tags.find(
					(tag) => tag[0] === "p" && tag[1] === pTag[1],
				);
				if (!existingPTag && pTag[1] !== agent.getPubkey()) {
					statusEvent.tags.push(pTag);
				}
			}

			// Add LLM metadata tags
			if (response.metadata) {
				// Add model tag
				if (response.metadata.model) {
					statusEvent.tags.push(["llm-model", response.metadata.model]);
				}

				// Add provider tag
				if (response.metadata.provider) {
					statusEvent.tags.push(["llm-provider", response.metadata.provider]);
				}

				// Add usage metadata
				if (response.metadata.usage) {
					const usage = response.metadata.usage;
					statusEvent.tags.push([
						"llm-prompt-tokens",
						String(usage.prompt_tokens),
					]);
					statusEvent.tags.push([
						"llm-completion-tokens",
						String(usage.completion_tokens),
					]);
					statusEvent.tags.push([
						"llm-total-tokens",
						String(usage.total_tokens),
					]);

					// Add cache information if available
					if (usage.cache_creation_input_tokens !== undefined) {
						statusEvent.tags.push([
							"llm-cache-creation-tokens",
							String(usage.cache_creation_input_tokens),
						]);
					}
					if (usage.cache_read_input_tokens !== undefined) {
						statusEvent.tags.push([
							"llm-cache-read-tokens",
							String(usage.cache_read_input_tokens),
						]);
					}
				}

				// Add confidence if available
				if (response.confidence !== undefined) {
					statusEvent.tags.push([
						"llm-confidence",
						String(response.confidence),
					]);
				}
				
				// Add system prompt if available
				if (response.metadata.systemPrompt) {
					statusEvent.tags.push([
						"llm-system-prompt",
						response.metadata.systemPrompt,
					]);
				}
				
				// Add user prompt if available
				if (response.metadata.userPrompt) {
					statusEvent.tags.push([
						"llm-user-prompt",
						response.metadata.userPrompt,
					]);
				}
			}

			// Sign with agent's signer
			await statusEvent.sign(agent.getSigner());
			await statusEvent.publish();

			logger.info(`Published task status for ${taskEvent.id}`);
		} catch (error) {
			logger.error(`Failed to publish task status: ${error}`);
		}
	}

	/**
	 * Get all available agents with their configurations
	 * Returns a map of agent name to their description and capabilities
	 */
	async getAllAvailableAgents(): Promise<
		Map<string, { description: string; role: string; capabilities: string }>
	> {
		const availableAgents = new Map<
			string,
			{ description: string; role: string; capabilities: string }
		>();

		// First, get all agents from agents.json
		const agentsPath = path.join(this.projectPath, ".tenex", "agents.json");
		try {
			const content = await fs.readFile(agentsPath, "utf-8");
			const agentsConfig: AgentsConfig = JSON.parse(content);

			for (const [agentName, configOrNsec] of Object.entries(agentsConfig)) {
				let configFile: string | undefined;

				// Handle both old format (string) and new format (object)
				if (typeof configOrNsec === "object" && configOrNsec.file) {
					configFile = configOrNsec.file;
				}

				// Try to load agent configuration
				let description = "";
				let role = "";
				let capabilities = "";

				if (configFile) {
					// Load from cached NDKAgent event file
					const defPath = path.join(
						this.projectPath,
						".tenex",
						"agents",
						configFile,
					);
					try {
						const definition = JSON.parse(await fs.readFile(defPath, "utf-8"));
						description = definition.description || "";
						role = definition.role || "";
						capabilities = definition.instructions || "";
					} catch (err) {
						// Fallback to checking agent-specific config
					}
				}

				// If not found, try agent-specific config file
				if (!description) {
					const agentConfigPath = path.join(
						this.projectPath,
						".tenex",
						"agents",
						`${agentName}.json`,
					);
					try {
						const agentConfig = JSON.parse(
							await fs.readFile(agentConfigPath, "utf-8"),
						);
						description = agentConfig.description || "";
						role = agentConfig.role || "";
						capabilities = agentConfig.instructions || "";
					} catch (err) {
						// Agent might not have a config file
					}
				}

				// Check if agent is already loaded
				const loadedAgent = this.agents.get(agentName);
				if (loadedAgent) {
					const config = loadedAgent.getConfig();
					description = description || config.description || "";
					role = role || config.role || "";
					capabilities = capabilities || config.instructions || "";
				}

				// Set default descriptions for common agents
				if (!description && agentName === "default") {
					description = "Default agent for general tasks";
					role = "General purpose assistant";
				}

				availableAgents.set(agentName, {
					description,
					role,
					capabilities,
				});
			}
		} catch (error) {
			logger.warn(`Failed to load agents for available agents list: ${error}`);
		}

		return availableAgents;
	}

	/**
	 * Generate environment context for agent system prompt
	 */
	generateEnvironmentContext(agentName: string): string {
		const parts: string[] = [];

		// Add agent identity
		parts.push(`## Environment Context`);
		parts.push(`You are ${agentName}, an AI agent in the TENEX system.`);

		// Add project information if available
		if (this.projectInfo) {
			parts.push(`\nYou are working on the project: "${this.projectInfo.title}"`);
			if (this.projectInfo.metadata.title) {
				parts.push(`Project Name: ${this.projectInfo.metadata.title}`);
			}
			if (this.projectInfo.repository) {
				parts.push(`Repository: ${this.projectInfo.repository}`);
			}
		}

		return parts.join("\n");
	}

	/**
	 * Format available agents information for system prompt
	 */
	async formatAvailableAgentsForPrompt(excludeAgent?: string): Promise<string> {
		const availableAgents = await this.getAllAvailableAgents();

		if (availableAgents.size === 0) {
			return "";
		}

		const agentsList: string[] = [];
		for (const [agentName, info] of availableAgents) {
			// Skip the current agent to avoid self-reference
			if (excludeAgent && agentName === excludeAgent) {
				continue;
			}

			let agentInfo = `- **${agentName}**`;
			if (info.description) {
				agentInfo += `: ${info.description}`;
			}
			if (info.role) {
				agentInfo += ` (Role: ${info.role})`;
			}
			agentsList.push(agentInfo);
		}

		if (agentsList.length === 0) {
			return "";
		}

		return `\n\n## Available Agents in the System\n\nYou are part of a multi-agent system. The following agents are available and may be working on related tasks:\n\n${agentsList.join("\n")}\n\nWhen appropriate, you can mention these agents by name in your responses to suggest collaboration or indicate which agent might be better suited for specific tasks.`;
	}
}
