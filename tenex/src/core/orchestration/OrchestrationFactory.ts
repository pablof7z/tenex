import { PromptBuilderImpl } from "@/core/orchestration/PromptBuilderImpl";
import { TeamFormationAnalyzerImpl } from "@/core/orchestration/TeamFormationAnalyzerImpl";
import { TeamOrchestratorImpl } from "@/core/orchestration/TeamOrchestrator";
import { OrchestrationCoordinator } from "@/core/orchestration/integration/OrchestrationCoordinator";
import type { OrchestrationConfig } from "@/core/orchestration/types";
import { defaultOrchestrationConfig } from "@/core/orchestration/types";
import type { ConversationStorage } from "@/utils/agents/ConversationStorage";
import { createLLMProvider } from "@/utils/agents/llm/LLMFactory";
import type { ToolEnabledProvider } from "@/utils/agents/llm/ToolEnabledProvider";
import type { LLMConfig } from "@/utils/agents/types";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { createAgentLogger, logger } from "@tenex/shared/logger";

export interface TypingIndicatorPublisher {
    publishTypingIndicator(
        originalEvent: NDKEvent,
        agentName: string,
        isTyping: boolean,
        message?: string,
        systemPrompt?: string,
        userPrompt?: string
    ): Promise<void>;
}

export interface OrchestrationDependencies {
    llmProvider: ToolEnabledProvider;
    llmConfig?: LLMConfig; // Full LLM config from the agent system
    allLLMConfigs?: Map<string, LLMConfig>; // All available LLM configurations
    conversationStorage: ConversationStorage;
    config?: Partial<OrchestrationConfig>;
    typingIndicatorPublisher?: TypingIndicatorPublisher;
}

export function createOrchestrationCoordinator(
    dependencies: OrchestrationDependencies
): OrchestrationCoordinator {
    const config: OrchestrationConfig = {
        ...defaultOrchestrationConfig,
        ...dependencies.config,
    };

    // Get team formation provider - use specific config if available
    let teamFormationProvider = dependencies.llmProvider;
    if (dependencies.allLLMConfigs) {
        const orchestratorLLMName = config.orchestrator?.teamFormationLLMConfig;
        if (orchestratorLLMName) {
            const orchestratorLLMConfig = dependencies.allLLMConfigs.get(orchestratorLLMName);
            if (orchestratorLLMConfig) {
                teamFormationProvider = createLLMProvider(
                    orchestratorLLMConfig
                ) as ToolEnabledProvider;
            }
        }
    }

    // Create components directly without adapters
    const promptBuilder = new PromptBuilderImpl();
    const analyzer = new TeamFormationAnalyzerImpl(
        teamFormationProvider,
        promptBuilder,
        config.orchestrator.maxTeamSize,
        dependencies.typingIndicatorPublisher
    );
    const orchestrator = new TeamOrchestratorImpl(
        analyzer,
        config,
        dependencies.typingIndicatorPublisher
    );

    return new OrchestrationCoordinator(
        orchestrator,
        dependencies.conversationStorage,
        createAgentLogger("Orchestration")
    );
}
