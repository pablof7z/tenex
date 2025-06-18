// Core types
export type {
    AgentConfig,
    AgentResponse,
    ConversationSignal,
    ConversationStore,
    EventContext,
    LLMProvider,
    Message,
    NostrPublisher,
    ProjectContext,
    Team as TeamType,
    TeamFormationRequest,
    TeamFormationResult,
    CompletionRequest,
    CompletionResponse,
    UsageStats,
} from "./core/types";

// Export errors selectively
export {
    AgentError,
    ConfigurationError,
    ConversationError,
} from "./core/errors";

// Infrastructure
export {
    LLMProviderWithTyping,
    createLLMProvider,
} from "./infrastructure/LLMProviderAdapter";
export {
    FileConversationStore,
    InMemoryConversationStore,
} from "./infrastructure/ConversationStore";
// NostrPublisher is already exported as a type above

// Domain
export { Agent } from "./domain/Agent";
export { Team } from "./domain/Team";
export { TeamLead } from "./domain/TeamLead";

// Application
export { EventRouter } from "./application/EventRouter";
export { TeamOrchestrator } from "./application/TeamOrchestrator";

import { ToolManager } from "@/utils/agents/tools/ToolManager";
import { ToolRegistry } from "@/utils/agents/tools/ToolRegistry";
import type { LLMConfig } from "@/utils/agents/types";
import type NDK from "@nostr-dev-kit/ndk";
import type { NDKProject, NDKSigner } from "@nostr-dev-kit/ndk";
import { EventRouter } from "./application/EventRouter";
import { TeamOrchestrator } from "./application/TeamOrchestrator";
import type { AgentConfig, ProjectContext } from "./core/types";
import { FileConversationStore } from "./infrastructure/ConversationStore";
import { createLLMProvider } from "./infrastructure/LLMProviderAdapter";
import { NostrPublisher } from "./infrastructure/NostrPublisher";

export interface AgentSystemConfig {
    projectPath: string;
    projectContext: ProjectContext;
    projectEvent?: NDKProject; // Optional project event for LLM context
    projectSigner?: NDKSigner; // Optional project signer for publishing events
    agents: Map<string, AgentConfig>;
    llmConfig: LLMConfig;
    teamBuildingLLMConfig?: LLMConfig; // Optional separate config for team formation
    ndk: NDK;
}

export async function createAgentSystem(config: AgentSystemConfig): Promise<EventRouter> {
    // Create infrastructure
    const store = new FileConversationStore(config.projectPath);
    await store.initialize();

    const publisher = new NostrPublisher(config.ndk, config.projectSigner);

    // Create tool manager
    const toolManager = new ToolManager();

    // Create event router
    const router = new EventRouter(
        new TeamOrchestrator(
            createLLMProvider(config.teamBuildingLLMConfig || config.llmConfig, publisher),
            publisher
        ),
        store,
        publisher,
        config.ndk,
        config.projectContext,
        config.projectEvent
    );

    // Configure router with agents and their tools
    const agentConfigsWithDefaults = new Map<string, AgentConfig>();
    for (const [name, agentConfig] of config.agents) {
        // Create tool registry for this agent
        const toolRegistry = toolManager.createAgentRegistry(name);

        // Enable agent-specific tools
        // Enable remember_lesson if agent has event ID
        if (agentConfig.eventId && config.ndk) {
            toolManager.enableRememberLessonTool(name, agentConfig.eventId, config.ndk);
        }

        // Enable find_agent for orchestrators
        if (agentConfig.hasOrchestrationCapability) {
            toolManager.enableFindAgentTool(name, true);
        }

        // Create LLM provider with tools
        const _llmProvider = createLLMProvider(config.llmConfig, publisher, toolRegistry);

        // Store agent config with defaults
        agentConfigsWithDefaults.set(name, agentConfig);
    }

    router.setAgentConfigs(agentConfigsWithDefaults);
    // Create a basic LLM provider without tools as fallback
    router.setLLMProvider(createLLMProvider(config.llmConfig, publisher));
    router.setLLMConfig(config.llmConfig);
    router.setToolManager(toolManager);

    return router;
}
