import type { AgentManager } from "@/utils/agents/AgentManager";
import type { Conversation } from "@/utils/agents/Conversation";
import type { ConversationStorage } from "@/utils/agents/ConversationStorage";
import { loadAgentConfig, saveAgentConfig } from "@/utils/agents/core/AgentConfigManager";
import { AgentConversationManager } from "@/utils/agents/core/AgentConversationManager";
import { AgentCore } from "@/utils/agents/core/AgentCore";
import { AgentResponseGenerator } from "@/utils/agents/core/AgentResponseGenerator";
import type { SystemPromptContext } from "@/utils/agents/prompts/types";
import type { ToolRegistry } from "@/utils/agents/tools/ToolRegistry";
import type { AgentConfig, AgentResponse, LLMConfig } from "@/utils/agents/types";
import type { NDK, NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";

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
        agentEventId?: string
    ) {
        this.core = new AgentCore(name, nsec, config, projectName, toolRegistry, agentEventId);
        this.conversationManager = new AgentConversationManager(this.core, storage);
        this.responseGenerator = new AgentResponseGenerator(this.core, this.conversationManager);
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

    getAvailableTools(): any[] {
        const toolRegistry = this.core.getToolRegistry();
        return toolRegistry ? toolRegistry.getAllTools() : [];
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

    // Delegation methods to conversation manager

    getConversation(conversationId: string): Conversation | undefined {
        return this.conversationManager.getConversation(conversationId);
    }

    /**
     * Create conversation with full system prompt context
     */
    async getOrCreateConversationWithContext(
        conversationId: string,
        context: Partial<SystemPromptContext>
    ): Promise<Conversation> {
        return this.conversationManager.getOrCreateConversationWithContext(conversationId, context);
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

    async saveConversationToStorage(conversation: Conversation): Promise<void> {
        return this.conversationManager.saveConversationToStorage(conversation);
    }

    static async loadFromConfig(
        name: string,
        nsec: string,
        projectPath: string,
        storage?: ConversationStorage,
        configFile?: string,
        projectName?: string,
        toolRegistry?: ToolRegistry
    ): Promise<Agent> {
        const { config, agentEventId } = await loadAgentConfig(
            name,
            nsec,
            projectPath,
            storage,
            configFile,
            projectName,
            toolRegistry
        );
        return new Agent(name, nsec, config, storage, projectName, toolRegistry, agentEventId);
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
        typingIndicatorCallback?: (message: string) => Promise<void>
    ): Promise<AgentResponse> {
        return this.responseGenerator.generateResponse(
            conversationId,
            llmConfig,
            projectPath,
            isFromAgent,
            typingIndicatorCallback
        );
    }

    /**
     * Notify the agent that its LLM configuration has changed
     * This allows the agent to update any cached configuration
     */
    notifyLLMConfigChange(newConfigName: string): void {
        logger.info(`Agent ${this.getName()} notified of LLM config change to: ${newConfigName}`);
        // The actual config will be loaded from AgentConfigurationManager
        // when the agent generates its next response
    }
}
