import type { ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import { createOrchestrationCoordinator } from "@/core/orchestration/OrchestrationFactory";
import type { OrchestrationCoordinator } from "@/core/orchestration/integration/OrchestrationCoordinator";
import { getNDK } from "@/nostr/ndkClient";
import type { Agent } from "@/utils/agents/Agent";
import { AgentCommunicationHandler } from "@/utils/agents/AgentCommunicationHandler";
import { AgentConfigurationManager } from "@/utils/agents/AgentConfigurationManager";
import { AgentOrchestrator } from "@/utils/agents/AgentOrchestrator";
import { ConversationStorage } from "@/utils/agents/ConversationStorage";
import type { ToolRegistry } from "@/utils/agents/tools/ToolRegistry";
import type { ToolDefinition } from "@/utils/agents/tools/types";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import type { LLMConfig } from "@tenex/types/llm";

/**
 * Main AgentManager class that orchestrates all agent operations
 * Now refactored into focused modules for better maintainability
 */
export class AgentManager {
    private projectPath: string;
    private conversationStorage: ConversationStorage;
    private _projectInfo?: ProjectRuntimeInfo;

    // Modular components
    private configManager: AgentConfigurationManager;
    private eventHandler: AgentCommunicationHandler;
    private orchestrator: AgentOrchestrator;
    private orchestrationCoordinator?: OrchestrationCoordinator;

    private ndk = getNDK();

    constructor(projectPath: string, projectInfo?: ProjectRuntimeInfo) {
        this.projectPath = projectPath;
        this._projectInfo = projectInfo;
        this.conversationStorage = new ConversationStorage(projectPath);

        // Initialize modular components
        this.configManager = new AgentConfigurationManager(projectPath);
        this.orchestrator = new AgentOrchestrator(
            this.configManager,
            this.conversationStorage,
            this._projectInfo
        );

        // Create event handler but don't pass agents Map yet (it's empty)
        // We'll update it after initialization
        this.eventHandler = new AgentCommunicationHandler(
            this.configManager,
            this.conversationStorage,
            new Map(), // Empty map for now
            this._projectInfo,
            undefined, // No orchestration coordinator yet
            this.ndk // Pass NDK instance if available
        );

        // Set dependencies for event handler
        this.eventHandler.setDependencies({
            getAgent: (name) => this.orchestrator.getAgent(name),
            getAgentByPubkey: (pubkey) => this.orchestrator.getAgentByPubkey(pubkey),
            isEventFromAnyAgent: (pubkey) => this.orchestrator.isEventFromAnyAgent(pubkey),
            formatAvailableAgentsForPrompt: (excludeAgent) =>
                this.orchestrator.formatAvailableAgentsForPrompt(excludeAgent),
            generateEnvironmentContext: (agentName) =>
                this.orchestrator.generateEnvironmentContext(agentName),
            getAllAvailableAgents: () => this.orchestrator.getAllAvailableAgents(),
        });

        // Set agent manager reference for all agents
        this.orchestrator.setAgentManagerForAll(this);
    }

    async initialize(): Promise<void> {
        try {
            // Initialize conversation storage
            await this.conversationStorage.initialize();

            // Initialize configuration manager
            await this.configManager.initialize();

            // Log configuration state after initialization
            logger.debug(
                `After initialization - LLM configs: ${Array.from(this.configManager.getAllLLMConfigs().keys()).join(", ")}`
            );
            logger.debug(
                `After initialization - Default LLM: ${this.configManager.getDefaultLLMName()}`
            );

            // Initialize orchestrator (loads agents)
            await this.orchestrator.initialize();

            // Create orchestration coordinator after everything is initialized
            if (this._projectInfo) {
                const defaultLLMConfig = this.configManager.getLLMConfig();
                logger.info("🎯 [Orchestration] Checking LLM configuration for orchestration...");
                logger.info(`   Project info available: ${!!this._projectInfo}`);
                logger.info(`   Default LLM config available: ${!!defaultLLMConfig}`);

                if (!defaultLLMConfig) {
                    logger.error("❌ [Orchestration] No default LLM configuration found!");
                    logger.error(
                        `   Available LLM configs: ${Array.from(this.configManager.getAllLLMConfigs().keys()).join(", ")}`
                    );
                    logger.error(`   Default LLM name: ${this.configManager.getDefaultLLMName()}`);
                    throw new Error(
                        "No LLM configuration available. Please ensure llms.json exists and contains a valid default configuration."
                    );
                }
                // Log LLM configuration being used for orchestration
                logger.info(
                    "✅ [Orchestration] Creating orchestration coordinator with LLM config:"
                );
                logger.info(`   LLM Name: ${this.configManager.getDefaultLLMName()}`);
                logger.info(`   Provider: ${defaultLLMConfig.provider}`);
                logger.info(`   Model: ${defaultLLMConfig.model}`);
                logger.info(`   Base URL: ${defaultLLMConfig.baseURL || "default"}`);
                logger.info(
                    `   API Key: ${defaultLLMConfig.apiKey ? `***${defaultLLMConfig.apiKey.slice(-4)}` : "NOT SET"}`
                );

                // Create a tool-enabled provider for orchestration
                const { createLLMProvider } = await import("./llm/LLMFactory");
                const llmProvider = createLLMProvider(defaultLLMConfig);

                // Load orchestration configuration if available
                const orchestrationConfig = await this.configManager.getOrchestrationConfig();

                // Create typing indicator publisher adapter
                const typingIndicatorPublisher = {
                    publishTypingIndicator: async (
                        originalEvent: NDKEvent,
                        agentName: string,
                        isTyping: boolean,
                        message?: string,
                        systemPrompt?: string,
                        userPrompt?: string
                    ) => {
                        try {
                            const { EnhancedResponsePublisher } = await import(
                                "./EnhancedResponsePublisher"
                            );
                            const publisher = new EnhancedResponsePublisher(
                                this.ndk || getNDK(),
                                this._projectInfo
                            );
                            // Create a mock agent for the orchestrator
                            const mockAgent = {
                                getName: () => agentName,
                                getSigner: () => {
                                    // Use project signer or a default one
                                    if (this._projectInfo?.projectNsec) {
                                        const { nip19 } = require("nostr-tools");
                                        // TODO: Implement proper signing with the decoded data
                                        // const { data } = nip19.decode(
                                        //     this._projectInfo.projectNsec
                                        // );
                                        return {
                                            sign: async (event: any) => {
                                                // Simple signing implementation
                                                return event;
                                            },
                                        };
                                    }
                                    throw new Error("No signer available for orchestrator");
                                },
                            };
                            await publisher.publishTypingIndicator(
                                originalEvent,
                                mockAgent as any,
                                isTyping,
                                message,
                                systemPrompt,
                                userPrompt
                            );
                        } catch (error) {
                            logger.warn(`Failed to publish typing indicator: ${error}`);
                        }
                    },
                };

                this.orchestrationCoordinator = await createOrchestrationCoordinator({
                    llmProvider,
                    llmConfig: defaultLLMConfig, // Pass the full config
                    allLLMConfigs: this.configManager.getAllLLMConfigs(), // Pass all available LLM configs
                    conversationStorage: this.conversationStorage,
                    config: orchestrationConfig || {
                        orchestrator: {
                            llmConfig: "default",
                            strategies: {},
                        },
                    },
                    typingIndicatorPublisher,
                });

                // Re-create event handler with orchestration support
                this.eventHandler = new AgentCommunicationHandler(
                    this.configManager,
                    this.conversationStorage,
                    this.orchestrator.getAllAgents(),
                    this._projectInfo,
                    this.orchestrationCoordinator,
                    this.ndk
                );

                // Set dependencies again
                this.eventHandler.setDependencies({
                    getAgent: (name) => this.orchestrator.getAgent(name),
                    getAgentByPubkey: (pubkey) => this.orchestrator.getAgentByPubkey(pubkey),
                    isEventFromAnyAgent: (pubkey) => this.orchestrator.isEventFromAnyAgent(pubkey),
                    formatAvailableAgentsForPrompt: (excludeAgent) =>
                        this.orchestrator.formatAvailableAgentsForPrompt(excludeAgent),
                    generateEnvironmentContext: (agentName) =>
                        this.orchestrator.generateEnvironmentContext(agentName),
                    getAllAvailableAgents: () => this.orchestrator.getAllAvailableAgents(),
                });
            }
        } catch (error) {
            logger.error("Failed to initialize AgentManager:", error);
            throw error;
        }

        // Update event handler with loaded agents if we didn't recreate it
        if (!this.orchestrationCoordinator) {
            this.eventHandler.updateAgentsMap(this.orchestrator.getAllAgents());
        }

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

    async updateAgentLLMConfig(agentName: string, newConfigName: string): Promise<boolean> {
        return this.configManager.updateAgentLLMConfig(agentName, newConfigName);
    }

    getAgentByPubkeySync(pubkey: string): Agent | undefined {
        return this.orchestrator.getAgentByPubkeySync(pubkey);
    }

    // Delegate agent management methods to orchestrator
    async getAgent(name: string): Promise<Agent> {
        if (!name) {
            throw new Error("Agent name is required");
        }
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
        agentName: string,
        llmName?: string,
        mentionedPubkeys: string[] = []
    ): Promise<void> {
        if (!agentName) {
            throw new Error("Agent name is required for handling chat events");
        }
        return this.eventHandler.handleChatEvent(event, agentName, llmName, mentionedPubkeys);
    }

    async handleTaskEvent(
        event: NDKEvent,
        agentName: string,
        llmName?: string,
        mentionedPubkeys: string[] = []
    ): Promise<void> {
        if (!agentName) {
            throw new Error("Agent name is required for handling task events");
        }
        return this.eventHandler.handleTaskEvent(event, agentName, llmName, mentionedPubkeys);
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

    // Set NDK instance for all agents
    setNDK(ndk: NDK): void {
        this.orchestrator.setNDK(ndk);
    }

    // Getter for project info - used by agents to access project information
    get projectInfo(): ProjectRuntimeInfo | undefined {
        return this._projectInfo;
    }
}
