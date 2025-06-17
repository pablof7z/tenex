import type { ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import { getNDK } from "@/nostr/ndkClient";
import { Agent } from "@/utils/agents/Agent";
import { loadAgentConfig } from "@/utils/agents/core/AgentConfigManager";
import type { AgentConfigurationManager } from "@/utils/agents/AgentConfigurationManager";
import type { AgentManager } from "@/utils/agents/AgentManager";
import type { ConversationStorage } from "@/utils/agents/ConversationStorage";
import { ToolManager } from "@/utils/agents/tools/ToolManager";
import type NDK from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/node";

/**
 * Orchestrates agent lifecycle and agent discovery
 * Delegates tool management to ToolManager
 */
export class AgentOrchestrator {
    private configManager: AgentConfigurationManager;
    private conversationStorage: ConversationStorage;
    private projectInfo?: ProjectRuntimeInfo;
    private agents: Map<string, Agent>;
    private toolManager: ToolManager;
    private agentManager?: AgentManager;

    constructor(
        configManager: AgentConfigurationManager,
        conversationStorage: ConversationStorage,
        projectInfo?: ProjectRuntimeInfo
    ) {
        this.configManager = configManager;
        this.conversationStorage = conversationStorage;
        this.projectInfo = projectInfo;
        this.agents = new Map();
        this.toolManager = new ToolManager();
    }

    /**
     * Initialize orchestrator with provided agents
     */
    async initialize(agents?: Map<string, Agent>): Promise<void> {
        if (agents) {
            this.agents = new Map(agents);
            // Set agent manager reference for all provided agents
            if (this.agentManager) {
                for (const agent of this.agents.values()) {
                    agent.setAgentManager(this.agentManager);
                }
            }
        } else {
            // Fallback to loading agents if none provided (for backward compatibility)
            await this.loadAgents();
        }
    }

    /**
     * Load agents from configuration
     */
    private async loadAgents(): Promise<void> {
        const agentsConfig = await this.configManager.loadAgentsConfig();

        for (const [name, config] of Object.entries(agentsConfig)) {
            const agent = await this.createAgent(name, config.nsec, config.file);

            // Set agent manager reference
            if (this.agentManager) {
                agent.setAgentManager(this.agentManager);
            }

            this.agents.set(name, agent);
        }
    }

    /**
     * Create a new agent with proper configuration
     */
    private async createAgent(name: string, nsec: string, configFile?: string): Promise<Agent> {
        // Create agent-specific tool registry
        const agentToolRegistry = this.toolManager.createAgentRegistry(name);

        const { config, agentEventId } = await loadAgentConfig(
            name,
            nsec,
            this.configManager.getProjectPath(),
            this.conversationStorage,
            configFile,
            this.projectInfo?.title || "unknown",
            agentToolRegistry
        );
        const agent = new Agent(name, nsec, config, this.conversationStorage, this.projectInfo?.title || "unknown", agentToolRegistry, agentEventId);

        // Set agent-specific LLM config or fall back to default
        const llmConfig = this.configManager.getLLMConfigForAgent(name);
        if (llmConfig) {
            agent.setLLMConfig(llmConfig);
        }

        // Enable remember_lesson tool if agent has an event ID
        const agentEventId = agent.getAgentEventId();
        if (agentEventId) {
            this.toolManager.enableRememberLessonTool(name, agentEventId, getNDK());
        }

        // Enable find_agent tool for agents with orchestration capability
        const agentConfig = agent.config;
        const hasOrchestrationCapability =
            agentConfig.role?.toLowerCase().includes("orchestrator") || name === "default"; // Default agent has orchestration capability
        this.toolManager.enableFindAgentTool(name, hasOrchestrationCapability);

        return agent;
    }

    /**
     * Get an agent by name
     * @param name The name of the agent to retrieve (required)
     */
    async getAgent(name: string): Promise<Agent> {
        if (!name) {
            throw new Error("Agent name is required");
        }
        const agent = this.agents.get(name);

        if (!agent) {
            throw new Error(
                `Agent '${name}' not found. Agents must be created through AgentManager.`
            );
        }

        return agent;
    }

    /**
     * Get agent by public key (synchronous version for already loaded agents)
     */
    getAgentByPubkeySync(pubkey: string): Agent | undefined {
        // Check loaded agents only
        for (const agent of this.agents.values()) {
            if (agent.pubkey === pubkey) {
                return agent;
            }
        }
        return undefined;
    }

    /**
     * Get agent by public key
     */
    async getAgentByPubkey(pubkey: string): Promise<Agent | undefined> {
        // Check loaded agents
        for (const agent of this.agents.values()) {
            if (agent.pubkey === pubkey) {
                return agent;
            }
        }

        return undefined;
    }

    /**
     * Check if an event is from any agent in the project
     */
    async isEventFromAnyAgent(eventPubkey: string): Promise<boolean> {
        // Check if the event is from any of the loaded agents
        for (const [_name, agent] of this.agents.entries()) {
            const agentPubkey = agent.pubkey;
            if (agentPubkey === eventPubkey) {
                return true;
            }
        }

        logger.info("👤 HUMAN DETECTED: Event is from a human user");
        return false;
    }

    /**
     * Get all loaded agents
     */
    getAllAgents(): Map<string, Agent> {
        return new Map(this.agents);
    }

    /**
     * Get all available agents with their configurations
     */
    async getAllAvailableAgents(): Promise<
        Map<string, { description: string; role: string; capabilities: string }>
    > {
        const availableAgents = new Map<
            string,
            { description: string; role: string; capabilities: string }
        >();

        const agentsConfig = await this.configManager.loadAgentsConfig();

        for (const [agentName, config] of Object.entries(agentsConfig)) {
            const configFile = config.file;

            // Try to load agent configuration
            let description = "";
            let role = "";
            let capabilities = "";

            if (configFile) {
                // Load from cached NDKAgent event file
                const definition = await this.configManager.loadAgentDefinition(configFile);
                if (definition) {
                    description = definition.description || "";
                    role = definition.role || "";
                    capabilities = definition.instructions || "";
                }
            }

            // If not found, try agent-specific config file
            if (!description) {
                const agentConfig = await this.configManager.loadAgentSpecificConfig(agentName);
                if (agentConfig) {
                    description = agentConfig.description || "";
                    role = agentConfig.role || "";
                    capabilities = agentConfig.instructions || "";
                }
            }

            // Check if agent is already loaded
            const loadedAgent = this.agents.get(agentName);
            if (loadedAgent) {
                const config = loadedAgent.config;
                description = description || config.description || "";
                role = role || config.role || "";
                capabilities = capabilities || config.instructions || "";
            }

            // Ensure we have a description
            if (!description) {
                description = `${agentName} agent`;
                role = role || `${agentName} specialist`;
            }

            availableAgents.set(agentName, {
                description,
                role,
                capabilities,
            });
        }

        return availableAgents;
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

    /**
     * Generate environment context for agent system prompt
     */
    generateEnvironmentContext(agentName: string): string {
        const parts: string[] = [];

        // Add agent identity
        parts.push("## Environment Context");
        parts.push(`You are ${agentName}, an AI agent in the TENEX system.`);

        // Add project information if available
        if (this.projectInfo) {
            parts.push(`\nYou are working on the project: "${this.projectInfo.title}"`);
            if (this.projectInfo.repository) {
                parts.push(`Repository: ${this.projectInfo.repository}`);
            }
        }

        return parts.join("\n");
    }

    /**
     * Get the tool registry (delegates to ToolManager)
     */
    getToolRegistry(): import("./tools/ToolRegistry").ToolRegistry {
        return this.toolManager.getDefaultRegistry();
    }

    /**
     * Register a new tool for all agents (delegates to ToolManager)
     */
    registerTool(tool: import("./tools/types").ToolDefinition): void {
        this.toolManager.registerGlobalTool(tool);
    }

    /**
     * Unregister a tool from all agents (delegates to ToolManager)
     */
    unregisterTool(toolName: string): void {
        this.toolManager.unregisterGlobalTool(toolName);
    }

    /**
     * Get the ToolManager instance (for testing or advanced usage)
     */
    getToolManager(): ToolManager {
        return this.toolManager;
    }

    /**
     * Add an agent to the orchestrator
     */
    addAgent(name: string, agent: Agent): void {
        this.agents.set(name, agent);

        // Set agent manager reference if we have one
        if (this.agentManager) {
            agent.setAgentManager(this.agentManager);
        }
    }

    /**
     * Set agent manager reference for all agents
     */
    setAgentManagerForAll(agentManager: AgentManager): void {
        this.agentManager = agentManager;
        for (const agent of this.agents.values()) {
            agent.setAgentManager(agentManager);
        }
    }

    /**
     * Set NDK instance for all agents
     */
    setNDK(ndk: NDK): void {
        // Implementation for setting NDK on agents
        // This method is required by AgentManager but the actual NDK setting
        // is handled elsewhere in the system
    }
}
