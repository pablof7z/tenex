import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { EVENT_KINDS } from "@tenex/types/events";
import type { LLMConfig } from "@tenex/types/llm";
import type { ProjectInfo } from "../../commands/run/ProjectLoader";
import type { CachedRule } from "../RulesManager";
import { logger } from "../logger";
import type { Agent } from "./Agent";
import type { AgentConfigurationManager } from "./AgentConfigurationManager";
import type { ConversationStorage } from "./ConversationStorage";
import type { SystemPromptContext } from "./prompts/types";
import type { AgentResponse } from "./types";

/**
 * Handles chat and task events for agents
 * Manages event processing, conversation management, and agent responses
 */
export class AgentEventHandler {
	private configManager: AgentConfigurationManager;
	private conversationStorage: ConversationStorage;
	private projectInfo?: ProjectInfo;
	private agents: Map<string, Agent>;
	private getAgentFn: (name?: string) => Promise<Agent>;
	private getAgentByPubkeyFn: (pubkey: string) => Promise<Agent | undefined>;
	private isEventFromAnyAgentFn: (eventPubkey: string) => Promise<boolean>;
	private formatAvailableAgentsForPromptFn: (
		excludeAgent?: string,
	) => Promise<string>;
	private generateEnvironmentContextFn: (agentName: string) => string;
	private getAllAvailableAgentsFn?: () => Promise<
		Map<string, { description: string; role: string; capabilities: string }>
	>;

	constructor(
		configManager: AgentConfigurationManager,
		conversationStorage: ConversationStorage,
		agents: Map<string, Agent>,
		projectInfo?: ProjectInfo,
	) {
		this.configManager = configManager;
		this.conversationStorage = conversationStorage;
		this.agents = agents;
		this.projectInfo = projectInfo;
	}

	/**
	 * Set function dependencies (injected to avoid circular dependencies)
	 */
	setDependencies(dependencies: {
		getAgent: (name?: string) => Promise<Agent>;
		getAgentByPubkey: (pubkey: string) => Promise<Agent | undefined>;
		isEventFromAnyAgent: (eventPubkey: string) => Promise<boolean>;
		formatAvailableAgentsForPrompt: (excludeAgent?: string) => Promise<string>;
		generateEnvironmentContext: (agentName: string) => string;
		getAllAvailableAgents?: () => Promise<
			Map<string, { description: string; role: string; capabilities: string }>
		>;
	}): void {
		this.getAgentFn = dependencies.getAgent;
		this.getAgentByPubkeyFn = dependencies.getAgentByPubkey;
		this.isEventFromAnyAgentFn = dependencies.isEventFromAnyAgent;
		this.formatAvailableAgentsForPromptFn =
			dependencies.formatAvailableAgentsForPrompt;
		this.generateEnvironmentContextFn = dependencies.generateEnvironmentContext;
		this.getAllAvailableAgentsFn = dependencies.getAllAvailableAgents;
	}

	/**
	 * Update the agents Map after initialization
	 */
	updateAgentsMap(agents: Map<string, Agent>): void {
		this.agents = agents;
	}

	/**
	 * Extract conversation ID from an event
	 */
	private extractConversationId(event: NDKEvent): string {
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

	/**
	 * Handle chat events with multi-agent orchestration
	 */
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
			logger.debug(`conversationId: ${conversationId}`);

			// First, add this event to ALL agents' conversation history for context tracking
			await this.addEventToAllAgentConversations(event, conversationId, false);
			logger.debug(" Added event to all agent conversations");

			// Determine which agents should respond
			const agentsToRespond = await this.determineRespondingAgents(
				event,
				conversationId,
				agentName,
				mentionedPubkeys,
				false, // isTaskEvent
			);

			logger.debug(
				` agentsToRespond after determination: ${agentsToRespond.length} agents`,
			);
			if (agentsToRespond.length === 0) {
				logger.debug(" No agents to respond, exiting handleChatEvent");
				return;
			}

			const llmConfig = this.configManager.getLLMConfig(llmName);
			if (!llmConfig) {
				this.logLLMConfigError(llmName);
				return;
			}

			// Have each agent respond to the event
			await this.processAgentResponses(
				agentsToRespond,
				event,
				ndk,
				conversationId,
				llmConfig,
				false, // isTaskEvent
			);

			// Mark event as processed only after all agents have responded
			await this.conversationStorage.markEventProcessed(
				event.id,
				event.created_at || Date.now() / 1000,
			);
		} catch (error) {
			this.logEventError("chat", event, error);
		}
	}

	/**
	 * Handle task events with multi-agent orchestration
	 */
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
			await this.addTaskToAllAgentConversations(
				event,
				taskId,
				title,
				taskContent,
			);

			// Determine which agents should respond
			const agentsToRespond = await this.determineRespondingAgents(
				event,
				taskId,
				agentName,
				mentionedPubkeys,
				true, // isTaskEvent
			);

			if (agentsToRespond.length === 0) {
				return;
			}

			const llmConfig = this.configManager.getLLMConfig(llmName);
			if (!llmConfig) {
				this.logLLMConfigError(llmName);
				return;
			}

			// Have each agent respond to the task
			await this.processAgentResponses(
				agentsToRespond,
				event,
				ndk,
				taskId,
				llmConfig,
				true, // isTaskEvent
			);

			// Mark event as processed only after all agents have responded
			await this.conversationStorage.markEventProcessed(
				event.id,
				event.created_at || Date.now() / 1000,
			);
		} catch (error) {
			this.logEventError("task", event, error);
		}
	}

	/**
	 * Add event to all agent conversations for context tracking
	 */
	private async addEventToAllAgentConversations(
		event: NDKEvent,
		conversationId: string,
		isTaskEvent: boolean,
	): Promise<void> {
		logger.debug(
			`addEventToAllAgentConversations called with event content: "${event.content}"`,
		);
		logger.debug(`conversationId: ${conversationId}`);
		logger.debug(`event author: ${event.author.pubkey}`);
		logger.debug(`number of agents: ${this.agents.size}`);

		for (const [name, agent] of this.agents) {
			logger.debug(
				` Processing agent: ${name}, agent pubkey: ${agent.getPubkey()}`,
			);

			// Skip if this is the agent's own message
			if (agent.getPubkey() === event.author.pubkey) {
				if (!isTaskEvent) {
					logger.debug(`Skipping adding event to ${name}'s own conversation`);
				}
				logger.debug(` Skipping agent ${name} - matches event author`);
				continue;
			}

			logger.debug(` Adding event to agent ${name}'s conversation`);
			const combinedRules = await this.getCombinedRulesForAgent(name);
			const environmentContext = this.generateEnvironmentContextFn(name);

			const conversation = await agent.getOrCreateConversation(
				conversationId,
				combinedRules,
				environmentContext,
			);

			logger.debug(
				` Got conversation for ${name}, current message count: ${conversation.getMessageCount()}`,
			);
			logger.debug(` About to add user message: "${event.content}"`);
			conversation.addUserMessage(event.content, event);
			logger.debug(
				` After adding user message, message count: ${conversation.getMessageCount()}`,
			);

			// Save the conversation to persist the context
			await this.conversationStorage.saveConversation(conversation.toJSON());
			logger.debug(
				`Added event to ${name} agent's conversation history for context`,
			);
		}
	}

	/**
	 * Add task to all agent conversations with task-specific metadata
	 */
	private async addTaskToAllAgentConversations(
		event: NDKEvent,
		taskId: string,
		title: string,
		taskContent: string,
	): Promise<void> {
		for (const [name, agent] of this.agents) {
			// Skip if this is the agent's own message
			if (agent.getPubkey() === event.author.pubkey) {
				continue;
			}

			const combinedRules = await this.getCombinedRulesForAgent(name);
			const environmentContext = this.generateEnvironmentContextFn(name);

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
	}

	/**
	 * Build full context for system prompt generation
	 */
	private async buildSystemPromptContext(
		agentName: string,
		isAgentToAgent = false,
	): Promise<Partial<SystemPromptContext>> {
		// Get project rules
		let projectRules: CachedRule[] = [];
		if (this.projectInfo?.rulesManager && this.projectInfo?.ruleMappings) {
			projectRules = this.projectInfo.rulesManager.getRulesForAgent(
				agentName,
				this.projectInfo.ruleMappings,
			);
		}

		// Get other agents info (if function is available)
		let otherAgents: Array<{
			name: string;
			description?: string;
			role?: string;
		}> = [];
		try {
			if (this.getAllAvailableAgentsFn) {
				const allAgents = await this.getAllAvailableAgentsFn();
				otherAgents = Array.from(allAgents.entries())
					.filter(([name]) => name !== agentName)
					.map(([name, info]) => ({
						name,
						description: info.description,
						role: info.role,
					}));
			}
		} catch (error) {
			// Gracefully handle missing dependency
			otherAgents = [];
		}

		return {
			projectInfo: this.projectInfo,
			projectRules,
			otherAgents,
			isAgentToAgent,
			specCache: this.projectInfo?.specCache,
		};
	}

	/**
	 * Get combined rules for an agent
	 */
	private async getCombinedRulesForAgent(
		agentName: string,
	): Promise<string | undefined> {
		let agentRules: string | undefined;
		if (this.projectInfo?.rulesManager && this.projectInfo?.ruleMappings) {
			const rules = this.projectInfo.rulesManager.getRulesForAgent(
				agentName,
				this.projectInfo.ruleMappings,
			);
			agentRules = this.projectInfo.rulesManager.formatRulesForPrompt(rules);
		}

		// Add available agents information to the rules
		const agentsInfo = await this.formatAvailableAgentsForPromptFn(agentName);
		return agentRules ? `${agentRules}${agentsInfo}` : agentsInfo || undefined;
	}

	/**
	 * Determine which agents should respond to an event
	 */
	private async determineRespondingAgents(
		event: NDKEvent,
		conversationId: string,
		defaultAgentName: string,
		mentionedPubkeys: string[],
		isTaskEvent: boolean,
	): Promise<Agent[]> {
		logger.debug(` determineRespondingAgents called for event ${event.id}`);
		logger.debug(` mentionedPubkeys: ${JSON.stringify(mentionedPubkeys)}`);
		logger.debug(` event author: ${event.author.pubkey}`);
		logger.debug(` isTaskEvent: ${isTaskEvent}`);

		// Check if the event is from another agent
		const isFromAgent = await this.isEventFromAnyAgentFn(event.author.pubkey);
		logger.debug(` isFromAgent: ${isFromAgent}`);

		// Check if any agents are already part of this conversation
		const participatingAgents: Agent[] = [];
		for (const [name, agent] of this.agents) {
			const conversation = agent.getConversation(conversationId);
			if (conversation?.isParticipant(agent.getPubkey())) {
				participatingAgents.push(agent);
			}
		}
		logger.debug(` participatingAgents count: ${participatingAgents.length}`);

		// Determine which agents should respond
		const agentsToRespond: Agent[] = [];

		// First, add any newly p-tagged agents
		if (mentionedPubkeys.length > 0) {
			logger.debug(` Processing ${mentionedPubkeys.length} mentioned pubkeys`);
			for (const pubkey of mentionedPubkeys) {
				logger.debug(` Looking up agent for pubkey: ${pubkey}`);
				const mentionedAgent = await this.getAgentByPubkeyFn(pubkey);
				logger.debug(
					` Found agent: ${mentionedAgent ? mentionedAgent.getName() : "null"}`,
				);
				if (
					mentionedAgent &&
					mentionedAgent.getPubkey() !== event.author.pubkey
				) {
					agentsToRespond.push(mentionedAgent);
					const eventType = isTaskEvent ? "task" : "conversation";
					logger.info(
						`Agent '${mentionedAgent.getName()}' was p-tagged${isTaskEvent ? " for task" : ""} and will ${isTaskEvent ? "respond" : "join the conversation"}`,
					);
				} else if (
					mentionedAgent &&
					mentionedAgent.getPubkey() === event.author.pubkey
				) {
					logger.debug(
						` Skipping self-mention for agent: ${mentionedAgent.getName()}`,
					);
				}
			}
		}

		// If this is from an agent and no agents were selected to respond, no one should respond
		logger.debug(
			` Anti-chatter check: isFromAgent=${isFromAgent}, agentsToRespond.length=${agentsToRespond.length}`,
		);
		if (isFromAgent && agentsToRespond.length === 0) {
			const eventType = isTaskEvent ? "Task" : "Event";
			logger.info(
				`${eventType} event is from an agent with no agents selected. No agents will respond to avoid unnecessary chatter.`,
			);
			return [];
		}

		// Then, add any existing participants (only if event is not from an agent)
		if (!isFromAgent) {
			// Special case: if no p-tags and only one other agent in conversation, that agent should respond
			if (mentionedPubkeys.length === 0 && participatingAgents.length === 1) {
				const singleAgent = participatingAgents[0];
				if (singleAgent.getPubkey() !== event.author.pubkey) {
					agentsToRespond.push(singleAgent);
					const context = isTaskEvent ? "on the task" : "in the conversation";
					logger.info(
						`Agent '${singleAgent.getName()}' is the only other agent ${context} and will respond`,
					);
				}
			} else {
				// Normal logic: add all participating agents
				for (const agent of participatingAgents) {
					if (
						!agentsToRespond.find((a) => a.getName() === agent.getName()) &&
						agent.getPubkey() !== event.author.pubkey
					) {
						agentsToRespond.push(agent);
						const context = isTaskEvent ? "on the task" : "in the conversation";
						logger.info(
							`Agent '${agent.getName()}' is already ${context} and will respond`,
						);
					}
				}
			}
		}

		// If no agents selected yet and event is not from an agent, use the default agent
		logger.debug(
			` Default agent check: agentsToRespond.length=${agentsToRespond.length}, isFromAgent=${isFromAgent}`,
		);
		if (agentsToRespond.length === 0 && !isFromAgent) {
			logger.debug(` Using default agent: ${defaultAgentName}`);
			const defaultAgent = await this.getAgentFn(defaultAgentName);

			if (defaultAgent.getPubkey() === event.author.pubkey) {
				const eventType = isTaskEvent ? "task" : "chat";
				logger.info(
					`Skipping ${eventType} event from agent '${defaultAgentName}' itself: ${event.id}`,
				);
				return [];
			}

			agentsToRespond.push(defaultAgent);
			logger.debug(" Added default agent to respond");
		}

		logger.debug(` Final agentsToRespond count: ${agentsToRespond.length}`);
		logger.debug(
			` Final agentsToRespond names: ${agentsToRespond.map((a) => a.getName()).join(", ")}`,
		);
		return agentsToRespond;
	}

	/**
	 * Process agent responses to an event
	 */
	private async processAgentResponses(
		agents: Agent[],
		event: NDKEvent,
		ndk: NDK,
		conversationId: string,
		llmConfig: LLMConfig,
		isTaskEvent: boolean,
	): Promise<void> {
		// Have each agent respond to the event
		for (const agent of agents) {
			try {
				// Get agent-specific LLM config if available
				const agentLLMConfig =
					this.configManager.getLLMConfigForAgent(agent.getName()) || llmConfig;

				// Extract system prompt and last message from conversation
				// Use getOrCreateConversation to ensure p-tagged agents can load conversations from storage
				const combinedRules = await this.getCombinedRulesForAgent(
					agent.getName(),
				);
				const environmentContext = this.generateEnvironmentContextFn(
					agent.getName(),
				);
				const conversation = await agent.getOrCreateConversation(
					conversationId,
					combinedRules,
					environmentContext,
				);

				// Check if we need to add the user message to this agent's conversation
				// This handles cases where the agent wasn't in the agents Map when addEventToAllAgentConversations was called
				if (
					conversation &&
					!isTaskEvent &&
					agent.getPubkey() !== event.author.pubkey
				) {
					const messages = conversation.getMessages();
					const lastMessage =
						messages.length > 0 ? messages[messages.length - 1] : null;

					// Only add the message if it's not already the last message in the conversation
					if (!lastMessage || lastMessage.event?.id !== event.id) {
						logger.debug(
							` Adding user message to ${agent.getName()}'s conversation: "${event.content}"`,
						);
						conversation.addUserMessage(event.content, event);
						// Save the updated conversation
						await this.conversationStorage.saveConversation(
							conversation.toJSON(),
						);
						logger.debug(
							` Updated conversation for ${agent.getName()}, now has ${conversation.getMessageCount()} messages`,
						);
					} else {
						logger.debug(
							` User message already exists in ${agent.getName()}'s conversation, skipping duplicate`,
						);
					}
				}

				let systemPrompt: string | undefined;
				let lastUserMessage: string | undefined;

				if (conversation) {
					const messages = conversation.getFormattedMessages();
					// Find system prompt
					const systemMessage = messages.find((msg) => msg.role === "system");
					if (systemMessage) {
						systemPrompt = systemMessage.content;

						// Add tool information to system prompt if tools are available
						const toolRegistry = agent.getToolRegistry();
						if (toolRegistry) {
							const availableTools = toolRegistry.getAllTools();
							if (availableTools.length > 0) {
								const toolPrompt = toolRegistry.generateSystemPrompt();
								systemPrompt = `${systemPrompt}\n\n${toolPrompt}`;
							}
						}
					}
					// Get the last user message (which should be the current event)
					const userMessages = messages.filter((msg) => msg.role === "user");
					if (userMessages.length > 0) {
						lastUserMessage = userMessages[userMessages.length - 1].content;
					}
				}

				// Publish typing indicator with system prompt and user prompt
				await this.publishTypingIndicator(
					ndk,
					event,
					agent,
					true,
					undefined,
					systemPrompt,
					lastUserMessage,
				);

				// Create typing indicator callback
				const typingIndicatorCallback = async (message: string) => {
					await this.publishTypingIndicator(
						ndk,
						event,
						agent,
						true,
						message,
						systemPrompt,
						lastUserMessage,
					);
				};

				// Check if the event is from another agent
				const isFromAgent = await this.isEventFromAnyAgentFn(
					event.author.pubkey,
				);

				// Generate response (the event is already in conversation history)
				const response = await agent.generateResponse(
					conversationId,
					agentLLMConfig,
					this.configManager.getProjectPath(),
					isFromAgent,
					typingIndicatorCallback,
				);

				// Only publish if agent has something meaningful to say
				if (
					!response.content.toLowerCase().includes("nothing to add") &&
					response.content.trim().length > 0
				) {
					// Add agent as participant in conversation
					const conversation = agent.getConversation(conversationId);
					if (conversation) {
						conversation.addParticipant(agent.getPubkey());
						await this.conversationStorage.saveConversation(
							conversation.toJSON(),
						);
					}

					// Publish response to Nostr
					await this.publishResponse(ndk, event, response, agent, isTaskEvent);
					const eventType = isTaskEvent ? "Task" : "Chat";
					logger.info(
						`${eventType} response generated and published by agent '${agent.getName()}'`,
					);

					// Stop typing indicator after publishing response
					await this.publishTypingIndicator(
						ndk,
						event,
						agent,
						false,
						undefined,
						undefined,
						undefined,
					);
				} else {
					logger.info(
						`Agent '${agent.getName()}' had nothing to add to the ${isTaskEvent ? "task" : "conversation"}`,
					);

					// Stop typing indicator since agent decided not to respond
					await this.publishTypingIndicator(
						ndk,
						event,
						agent,
						false,
						undefined,
						undefined,
						undefined,
					);
				}
			} catch (error) {
				logger.error(
					`Failed to generate response for agent '${agent.getName()}': ${error}`,
				);

				// Stop typing indicator on error
				try {
					await this.publishTypingIndicator(
						ndk,
						event,
						agent,
						false,
						undefined,
						undefined,
						undefined,
					);
				} catch (indicatorError) {
					logger.error(`Failed to stop typing indicator: ${indicatorError}`);
				}
			}
		}
	}

	/**
	 * Publish typing indicator event
	 */
	private async publishTypingIndicator(
		ndk: NDK,
		originalEvent: NDKEvent,
		agent: Agent,
		isTyping: boolean,
		message?: string,
		systemPrompt?: string,
		userPrompt?: string,
	): Promise<void> {
		try {
			const typingEvent = new NDKEvent(ndk);
			typingEvent.kind = isTyping
				? EVENT_KINDS.TYPING_INDICATOR
				: EVENT_KINDS.TYPING_INDICATOR_STOP;
			typingEvent.content = message || "";

			// Add event reference
			typingEvent.tags.push(["e", originalEvent.id]);

			// Add project reference - REQUIRED
			if (!this.projectInfo?.projectEvent) {
				throw new Error(
					"Project event is required for tenex run - cannot proceed without project context",
				);
			}
			typingEvent.tag(this.projectInfo.projectEvent);

			// Add system prompt for start typing events
			if (isTyping && systemPrompt) {
				typingEvent.tags.push(["system-prompt", systemPrompt]);
			}

			// Add user prompt for start typing events
			logger.debug(
				` Typing indicator userPrompt: ${userPrompt ? `"${userPrompt.substring(0, 100)}..."` : "undefined"}`,
			);
			if (isTyping && userPrompt) {
				typingEvent.tags.push(["prompt", userPrompt]);
				logger.debug(
					` Added prompt tag to typing indicator: "${userPrompt.substring(0, 100)}..."`,
				);
			} else if (isTyping) {
				logger.debug(
					" No userPrompt for typing indicator - prompt tag will NOT be added",
				);
			}

			await typingEvent.sign(agent.getSigner());
			await typingEvent.publish();
		} catch (error) {
			logger.warn(`Failed to publish typing indicator: ${error}`);
		}
	}

	/**
	 * Publish response event
	 */
	private async publishResponse(
		ndk: NDK,
		originalEvent: NDKEvent,
		response: AgentResponse,
		agent: Agent,
		isTaskEvent: boolean,
	): Promise<void> {
		try {
			// Create reply event with proper reply tags
			const responseEvent = originalEvent.reply();
			responseEvent.content = response.content;

			// Remove all p-tags that NDK's .reply() generated
			responseEvent.tags = responseEvent.tags.filter((tag) => tag[0] !== "p");

			// Add project reference - REQUIRED
			if (!this.projectInfo?.projectEvent) {
				throw new Error(
					"Project event is required for tenex run - cannot proceed without project context",
				);
			}
			responseEvent.tag(this.projectInfo.projectEvent);

			// Add LLM metadata if available
			if (response.metadata.model) {
				responseEvent.tags.push(["llm-model", response.metadata.model]);
			}
			if (response.metadata.provider) {
				responseEvent.tags.push(["llm-provider", response.metadata.provider]);
			}

			// Add token usage if available
			const usage = response.metadata.usage;
			if (usage) {
				if (usage.prompt_tokens) {
					responseEvent.tags.push([
						"llm-input-tokens",
						String(usage.prompt_tokens),
					]);
				}
				if (usage.completion_tokens) {
					responseEvent.tags.push([
						"llm-output-tokens",
						String(usage.completion_tokens),
					]);
				}
				if (usage.total_tokens) {
					responseEvent.tags.push([
						"llm-total-tokens",
						String(usage.total_tokens),
					]);
				}
				if (usage.cache_read_input_tokens) {
					responseEvent.tags.push([
						"llm-cache-read-tokens",
						String(usage.cache_read_input_tokens),
					]);
				}
				if (usage.cost) {
					responseEvent.tags.push(["llm-cost", String(usage.cost)]);
				}
			}

			// Add confidence if available
			if (response.confidence !== undefined) {
				responseEvent.tags.push([
					"llm-confidence",
					String(response.confidence),
				]);
			}

			if (response.metadata.systemPrompt) {
				responseEvent.tags.push([
					"system-prompt",
					response.metadata.systemPrompt,
				]);
			}
			if (response.metadata.userPrompt) {
				responseEvent.tags.push(["prompt", response.metadata.userPrompt]);
			} else {
				logger.debug(" No userPrompt found - prompt tag will NOT be added");
			}

			// Add temperature and max tokens if configured
			// Note: These would need to be passed from the LLM config
			// For now, we'll add them when they become available in metadata

			await responseEvent.sign(agent.getSigner());
			responseEvent.publish();
		} catch (error) {
			logger.error(`Failed to publish response: ${error}`);
		}
	}

	/**
	 * Log LLM configuration error
	 */
	private logLLMConfigError(llmName?: string): void {
		logger.error("No LLM configuration available for response");
		logger.error(`Requested LLM: ${llmName || "default"}`);
		logger.error(
			`Available LLMs: ${Array.from(this.configManager.getAllLLMConfigs().keys()).join(", ")}`,
		);
		logger.error(`Default LLM name: ${this.configManager.getDefaultLLMName()}`);
	}

	/**
	 * Log event processing error
	 */
	private logEventError(
		eventType: string,
		event: NDKEvent,
		error: unknown,
	): void {
		logger.error(`Failed to handle ${eventType} event: ${error}`);
		logger.error(
			`Error details: ${error instanceof Error ? error.stack : String(error)}`,
		);
		logger.error("Event details:");
		logger.error(event.inspect);
	}
}
