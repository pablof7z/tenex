import { PromptBuilderImpl } from "@/core/orchestration/PromptBuilderImpl";
import { TeamFormationAnalyzerImpl } from "@/core/orchestration/TeamFormationAnalyzerImpl";
import { TeamOrchestratorImpl } from "@/core/orchestration/TeamOrchestrator";
import { ConsoleLoggerAdapter } from "@/core/orchestration/adapters/ConsoleLoggerAdapter";
import { LLMProviderAdapter } from "@/core/orchestration/adapters/LLMProviderAdapter";
import { OrchestrationCoordinator } from "@/core/orchestration/integration/OrchestrationCoordinator";
import type { OrchestrationConfig } from "@/core/orchestration/types";
import { defaultOrchestrationConfig } from "@/core/orchestration/types";
import type { ConversationStorage } from "@/utils/agents/ConversationStorage";
import { createLLMProvider } from "@/utils/agents/llm/LLMFactory";
import type { ToolEnabledProvider } from "@/utils/agents/llm/ToolEnabledProvider";
import type { LLMConfig } from "@/utils/agents/types";
import type { NDKEvent } from "@nostr-dev-kit/ndk";

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

/**
 * Factory function for creating orchestration components with proper dependency injection
 */
export function createOrchestrationCoordinator(
    dependencies: OrchestrationDependencies
): OrchestrationCoordinator {
    // Merge with default config
    const config: OrchestrationConfig = {
        ...defaultOrchestrationConfig,
        ...dependencies.config,
    };

    // Create adapters
    let teamFormationProvider = dependencies.llmProvider;
    let teamFormationConfig = dependencies.llmConfig;

    // Check if a specific orchestrator LLM config is specified from the simple string format
    if (dependencies.allLLMConfigs) {
        // Check if orchestrator is defined as a simple string in the loaded config
        const orchestratorLLMName = config.orchestrator?.teamFormationLLMConfig;
        if (orchestratorLLMName) {
            const orchestratorLLMConfig = dependencies.allLLMConfigs.get(orchestratorLLMName);
            if (orchestratorLLMConfig) {
                teamFormationProvider = createLLMProvider(
                    orchestratorLLMConfig
                ) as ToolEnabledProvider;
                teamFormationConfig = orchestratorLLMConfig;
            }
        }
    }

    const llmProviderAdapter = new LLMProviderAdapter(
        dependencies.llmProvider,
        dependencies.llmConfig
    );
    const teamFormationProviderAdapter = new LLMProviderAdapter(
        teamFormationProvider,
        teamFormationConfig
    );
    const logger = new ConsoleLoggerAdapter("Orchestration");

    // Create components
    const promptBuilder = new PromptBuilderImpl();
    const analyzer = new TeamFormationAnalyzerImpl(
        teamFormationProviderAdapter,
        promptBuilder,
        config.orchestrator.maxTeamSize,
        dependencies.typingIndicatorPublisher
    );
    const orchestrator = new TeamOrchestratorImpl(
        analyzer,
        llmProviderAdapter,
        logger,
        config,
        dependencies.typingIndicatorPublisher
    );

    // Create coordinator
    return new OrchestrationCoordinator(orchestrator, dependencies.conversationStorage, logger);
}
