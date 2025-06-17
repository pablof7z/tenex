import type { AgentManager } from "@/utils/agents/AgentManager";
import { SystemPromptBuilder } from "@/utils/agents/prompts/SystemPromptBuilder";
import type { SystemPromptContext } from "@/utils/agents/prompts/types";
import type { ToolRegistry } from "@/utils/agents/tools/ToolRegistry";
import type { AgentConfig, LLMConfig } from "@/utils/agents/types";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { AgentLogger } from "@tenex/shared/logger";
import { createAgentLogger } from "@tenex/shared/logger";

export class AgentCore {
    readonly name: string;
    readonly nsec: string;
    readonly signer: NDKPrivateKeySigner;
    readonly config: AgentConfig;
    defaultLLMConfig?: LLMConfig;
    readonly logger: AgentLogger;
    readonly projectName: string;
    toolRegistry?: ToolRegistry;
    readonly agentEventId?: string;
    agentManager?: AgentManager;
    readonly systemPromptBuilder: SystemPromptBuilder;

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

    get pubkey(): string {
        return this.signer.pubkey;
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
