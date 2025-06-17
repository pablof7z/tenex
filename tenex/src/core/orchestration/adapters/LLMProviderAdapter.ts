import type {
    LLMConfigOverrides,
    LLMProvider,
    LLMResponse as OrchestrationLLMResponse,
} from "@/core/orchestration/types";
import type { ToolEnabledProvider } from "@/utils/agents/llm/ToolEnabledProvider";
import type { LLMResponse as AgentLLMResponse } from "@/utils/agents/llm/types";
import type { LLMConfig as AgentLLMConfig } from "@/utils/agents/types";
import { logger } from "@tenex/shared/logger";

/**
 * Adapter that bridges the orchestration LLMProvider interface
 * with the existing agent LLM system
 */
export class LLMProviderAdapter implements LLMProvider {
    constructor(
        private readonly agentLLMProvider: ToolEnabledProvider,
        private readonly baseConfig?: AgentLLMConfig // Full LLM config from agent system
    ) {
        if (!agentLLMProvider) {
            throw new Error("AgentLLMProvider is required");
        }
    }

    /**
     * Get the configuration for this LLM provider adapter
     */
    getConfig(): AgentLLMConfig | undefined {
        return this.baseConfig;
    }

    async complete(prompt: string, config?: LLMConfigOverrides): Promise<OrchestrationLLMResponse> {
        // Log provider state
        logger.debug("[LLMProviderAdapter] complete called");
        logger.debug(`[LLMProviderAdapter] agentLLMProvider exists: ${!!this.agentLLMProvider}`);
        logger.debug(`[LLMProviderAdapter] baseConfig exists: ${!!this.baseConfig}`);
        if (this.baseConfig) {
            logger.debug(`[LLMProviderAdapter] baseConfig.provider: ${this.baseConfig.provider}`);
            logger.debug(`[LLMProviderAdapter] baseConfig.model: ${this.baseConfig.model}`);
        }

        // Convert config to agent LLM format
        const messages = [
            {
                role: "user" as const,
                content: prompt,
            },
        ];

        // Merge base config with orchestration config overrides
        // Important: Only override specific fields, not the entire config object
        const agentConfig = {
            ...this.baseConfig, // Include full config with apiKey etc
            // Only override specific fields if provided
            ...(config?.model && { model: config.model }),
            ...(config?.temperature !== undefined && { temperature: config.temperature }),
            ...(config?.maxTokens && { maxTokens: config.maxTokens }),
        };

        logger.debug("[LLMProviderAdapter] Calling generateResponse with config:", {
            provider: "provider" in agentConfig ? agentConfig.provider : "unknown",
            model: "model" in agentConfig ? agentConfig.model : "unknown",
            hasApiKey: "apiKey" in agentConfig ? !!agentConfig.apiKey : false,
        });

        // Call the agent LLM provider using the correct method
        const response = await this.agentLLMProvider.generateResponse(
            messages,
            agentConfig as AgentLLMConfig
        );

        // Convert response to orchestration format
        return this.convertResponse(response);
    }

    private convertResponse(agentResponse: AgentLLMResponse): OrchestrationLLMResponse {
        return {
            content: agentResponse.content,
            usage: agentResponse.usage
                ? {
                      prompt_tokens: agentResponse.usage.prompt_tokens,
                      completion_tokens: agentResponse.usage.completion_tokens,
                      total_tokens: agentResponse.usage.total_tokens,
                  }
                : undefined,
        };
    }
}
