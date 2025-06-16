import type { AgentManager } from "@/utils/agents/AgentManager";
import { SystemPromptBuilder } from "@/utils/agents/prompts/SystemPromptBuilder";
import type { SystemPromptContext } from "@/utils/agents/prompts/types";
import type { ToolRegistry } from "@/utils/agents/tools/ToolRegistry";
import type { AgentConfig, LLMConfig } from "@/utils/agents/types";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";
import type { AgentLogger } from "@tenex/shared/logger";
import { createAgentLogger } from "@tenex/shared/logger";

export class AgentCore {
    private name: string;
    private nsec: string;
    private signer: NDKPrivateKeySigner;
    private config: AgentConfig;
    private defaultLLMConfig?: LLMConfig;
    private logger: AgentLogger;
    private projectName: string;
    private toolRegistry?: ToolRegistry;
    private agentEventId?: string;
    private ndk?: NDK;
    private agentManager?: AgentManager;
    private systemPromptBuilder: SystemPromptBuilder;

    constructor(
        name: string,
        nsec: string,
        config: AgentConfig,
        projectName?: string,
        toolRegistry?: ToolRegistry,
        agentEventId?: string
    ) {
        this.name = name;
        this.nsec = nsec;
        this.signer = new NDKPrivateKeySigner(nsec);
        this.config = config;
        this.projectName = projectName || "unknown";
        this.logger = createAgentLogger(this.projectName, this.name);
        this.toolRegistry = toolRegistry;
        this.agentEventId = agentEventId;
        this.systemPromptBuilder = new SystemPromptBuilder();
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

    setNDK(ndk: NDK): void {
        this.ndk = ndk;
    }

    getNDK(): NDK | undefined {
        return this.ndk;
    }

    setAgentManager(agentManager: AgentManager): void {
        this.agentManager = agentManager;
    }

    getAgentManager(): AgentManager | undefined {
        return this.agentManager;
    }

    getLogger(): AgentLogger {
        return this.logger;
    }

    getProjectName(): string {
        return this.projectName;
    }

    /**
     * Get the SystemPromptBuilder instance for advanced configuration
     */
    getSystemPromptBuilder(): SystemPromptBuilder {
        return this.systemPromptBuilder;
    }

    /**
     * Build system prompt with full context using SystemPromptBuilder
     */
    buildSystemPromptWithContext(context: Partial<SystemPromptContext>): string {
        // Merge provided context with agent's own information
        const fullContext: SystemPromptContext = {
            agentName: this.name,
            agentConfig: this.config,
            ...context,
        };

        return this.systemPromptBuilder.build(fullContext);
    }
}
