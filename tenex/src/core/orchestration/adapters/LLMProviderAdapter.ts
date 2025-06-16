import type { ToolEnabledProvider } from "../../../utils/agents/llm/ToolEnabledProvider";
import type { LLMResponse as AgentLLMResponse } from "../../../utils/agents/llm/types";
import type { LLMConfig, LLMProvider, LLMResponse as OrchestrationLLMResponse } from "../types";

/**
 * Adapter that bridges the orchestration LLMProvider interface
 * with the existing agent LLM system
 */
export class LLMProviderAdapter implements LLMProvider {
    constructor(private readonly agentLLMProvider: ToolEnabledProvider) {
        if (!agentLLMProvider) {
            throw new Error("AgentLLMProvider is required");
        }
    }

    async complete(prompt: string, config?: LLMConfig): Promise<OrchestrationLLMResponse> {
        // Convert config to agent LLM format
        const messages = [
            {
                role: "user" as const,
                content: prompt,
            },
        ];

        // Map config to agent LLM config if provided
        const agentConfig = config
            ? {
                  model: config.model,
                  temperature: config.temperature,
                  max_tokens: config.maxTokens,
              }
            : undefined;

        // Call the agent LLM provider
        const response = await this.agentLLMProvider.complete(messages, agentConfig);

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
