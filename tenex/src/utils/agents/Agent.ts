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
import type NDK from "@nostr-dev-kit/ndk";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";

export class Agent {
    readonly core: AgentCore;
    readonly conversationManager: AgentConversationManager;
    readonly responseGenerator: AgentResponseGenerator;

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

    get name(): string {
        return this.core.name;
    }

    get nsec(): string {
        return this.core.nsec;
    }

    get signer() {
        return this.core.signer;
    }

    get pubkey(): string {
        return this.core.pubkey;
    }

    get config(): AgentConfig {
        return this.core.config;
    }

    get availableTools(): any[] {
        return this.core.toolRegistry ? this.core.toolRegistry.getAllTools() : [];
    }

    getConversation(conversationId: string): Conversation | undefined {
        return this.conversationManager.getConversation(conversationId);
    }

    async getOrCreateConversationWithContext(
        conversationId: string,
        context: Partial<SystemPromptContext>
    ): Promise<Conversation> {
        return this.conversationManager.getOrCreateConversationWithContext(conversationId, context);
    }

    get allConversations(): Map<string, Conversation> {
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


    async saveConfig(projectPath: string): Promise<void> {
        await saveAgentConfig(this.name, this.config, projectPath);
    }

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
     * Set the LLM configuration for this agent
     */
    setLLMConfig(llmConfig: LLMConfig): void {
        this.core.defaultLLMConfig = llmConfig;
    }

    /**
     * Get the agent event ID if available
     */
    getAgentEventId(): string | undefined {
        return this.core.agentEventId;
    }

    /**
     * Set the agent manager reference
     */
    setAgentManager(agentManager: AgentManager): void {
        this.core.agentManager = agentManager;
    }

    /**
     * Notify the agent that its LLM configuration has changed
     * This allows the agent to update any cached configuration
     */
    notifyLLMConfigChange(newConfigName: string): void {
        logger.info(`Agent ${this.name} notified of LLM config change to: ${newConfigName}`);
        // The actual config will be loaded from AgentConfigurationManager
        // when the agent generates its next response
    }
}
