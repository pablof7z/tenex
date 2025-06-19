/**
 * Consolidated token usage and cost tracking types
 */

export interface TokenUsage {
    readonly _brand: "TokenUsage";
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
    cost?: number;
    costUsd?: number;
}

/**
 * Factory function to create TokenUsage from various input formats
 */
export function createTokenUsage(input: {
    // Support both camelCase and snake_case inputs
    promptTokens?: number;
    prompt_tokens?: number;
    completionTokens?: number;
    completion_tokens?: number;
    totalTokens?: number;
    total_tokens?: number;
    cacheCreationTokens?: number;
    cache_creation_input_tokens?: number;
    cache_creation_tokens?: number;
    cacheReadTokens?: number;
    cache_read_input_tokens?: number;
    cache_read_tokens?: number;
    cost?: number;
    costUsd?: number;
}): TokenUsage {
    const promptTokens = input.promptTokens ?? input.prompt_tokens ?? 0;
    const completionTokens = input.completionTokens ?? input.completion_tokens ?? 0;

    return {
        _brand: "TokenUsage",
        promptTokens,
        completionTokens,
        totalTokens: input.totalTokens ?? input.total_tokens ?? promptTokens + completionTokens,
        cacheCreationTokens:
            input.cacheCreationTokens ??
            input.cache_creation_input_tokens ??
            input.cache_creation_tokens,
        cacheReadTokens:
            input.cacheReadTokens ?? input.cache_read_input_tokens ?? input.cache_read_tokens,
        cost: input.cost,
        costUsd: input.costUsd,
    };
}

/**
 * Convert TokenUsage to legacy snake_case format for backward compatibility
 */
export function toSnakeCaseUsage(usage: TokenUsage): {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    cost?: number;
} {
    return {
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
        cache_creation_input_tokens: usage.cacheCreationTokens,
        cache_read_input_tokens: usage.cacheReadTokens,
        cost: usage.cost,
    };
}
