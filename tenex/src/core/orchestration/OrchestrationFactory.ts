import type { ConversationStorage } from "../../utils/agents/ConversationStorage";
import type { ToolEnabledProvider } from "../../utils/agents/llm/ToolEnabledProvider";
import { PromptBuilderImpl } from "./PromptBuilderImpl";
import { TeamFormationAnalyzerImpl } from "./TeamFormationAnalyzerImpl";
import { TeamOrchestratorImpl } from "./TeamOrchestrator";
import { ConsoleLoggerAdapter } from "./adapters/ConsoleLoggerAdapter";
import { LLMProviderAdapter } from "./adapters/LLMProviderAdapter";
import { OrchestrationCoordinator } from "./integration/OrchestrationCoordinator";
import type { OrchestrationConfig } from "./types";
import { defaultOrchestrationConfig } from "./types";

export interface OrchestrationDependencies {
    llmProvider: ToolEnabledProvider;
    conversationStorage: ConversationStorage;
    config?: Partial<OrchestrationConfig>;
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
    const llmProviderAdapter = new LLMProviderAdapter(dependencies.llmProvider);
    const logger = new ConsoleLoggerAdapter("Orchestration");

    // Create components
    const promptBuilder = new PromptBuilderImpl();
    const analyzer = new TeamFormationAnalyzerImpl(llmProviderAdapter, promptBuilder);
    const orchestrator = new TeamOrchestratorImpl(analyzer, llmProviderAdapter, logger, config);

    // Create coordinator
    return new OrchestrationCoordinator(orchestrator, dependencies.conversationStorage);
}
