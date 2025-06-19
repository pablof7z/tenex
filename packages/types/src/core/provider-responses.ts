/**
 * Enhanced provider response types with discriminated unions
 */

import type { TokenUsage } from "./usage";
import { createTokenUsage } from "./usage";

// ============================================================================
// Base Provider Response Types
// ============================================================================

export interface BaseProviderResponse {
    readonly _brand: "ProviderResponse";
    readonly provider: string;
    model: string;
}

// ============================================================================
// Anthropic Response Types
// ============================================================================

export interface AnthropicUsage {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
}

export interface AnthropicTextContent {
    type: "text";
    text: string;
}

export interface AnthropicToolContent {
    type: "tool_use";
    name: string;
    input: Record<string, unknown>;
    id: string;
}

export type AnthropicContent = AnthropicTextContent | AnthropicToolContent;

export interface AnthropicResponse extends BaseProviderResponse {
    readonly provider: "anthropic";
    id: string;
    type: "message";
    role: "assistant";
    content: AnthropicContent[];
    stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use";
    stop_sequence?: string;
    usage: AnthropicUsage;
}

// ============================================================================
// OpenAI Response Types
// ============================================================================

export interface OpenAIUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface OpenAIToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}

export interface OpenAIMessage {
    role: "assistant";
    content: string | null;
    tool_calls?: OpenAIToolCall[];
    refusal?: string;
}

export interface OpenAIChoice {
    index: number;
    message: OpenAIMessage;
    logprobs?: Record<string, unknown> | null;
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "function_call";
}

export interface OpenAIResponse extends BaseProviderResponse {
    readonly provider: "openai";
    id: string;
    object: "chat.completion";
    created: number;
    choices: OpenAIChoice[];
    usage?: OpenAIUsage;
    system_fingerprint?: string;
}

// ============================================================================
// OpenRouter Response Types
// ============================================================================

export interface OpenRouterUsage extends OpenAIUsage {
    total_cost?: number;
}

export interface OpenRouterResponse extends BaseProviderResponse {
    readonly provider: "openrouter";
    id: string;
    object: "chat.completion";
    created: number;
    choices: OpenAIChoice[];
    usage?: OpenRouterUsage;
    system_fingerprint?: string;
    openrouter_provider?: string;
    model_used?: string;
}

// ============================================================================
// Ollama Response Types
// ============================================================================

export interface OllamaResponse extends BaseProviderResponse {
    readonly provider: "ollama";
    created_at: string;
    message: {
        role: "assistant";
        content: string;
        tool_calls?: OpenAIToolCall[];
    };
    done: boolean;
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    prompt_eval_duration?: number;
    eval_count?: number;
    eval_duration?: number;
}

// ============================================================================
// Google Response Types (for future use)
// ============================================================================

export interface GoogleResponse extends BaseProviderResponse {
    readonly provider: "google";
    candidates: Array<{
        content: {
            parts: Array<{
                text?: string;
                functionCall?: {
                    name: string;
                    args: Record<string, unknown>;
                };
            }>;
            role: string;
        };
        finishReason: string;
        index: number;
    }>;
    usageMetadata?: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
    };
}

// ============================================================================
// Discriminated Union
// ============================================================================

export type ProviderResponse =
    | AnthropicResponse
    | OpenAIResponse
    | OpenRouterResponse
    | OllamaResponse
    | GoogleResponse;

// ============================================================================
// Type Guards
// ============================================================================

export const isAnthropicResponse = (response: unknown): response is AnthropicResponse =>
    typeof response === "object" &&
    response !== null &&
    "_brand" in response &&
    response._brand === "ProviderResponse" &&
    "provider" in response &&
    response.provider === "anthropic" &&
    "type" in response &&
    response.type === "message" &&
    "content" in response &&
    Array.isArray(response.content) &&
    "usage" in response &&
    typeof response.usage === "object" &&
    response.usage !== null &&
    "input_tokens" in response.usage &&
    typeof response.usage.input_tokens === "number";

export const isOpenAIResponse = (response: unknown): response is OpenAIResponse =>
    typeof response === "object" &&
    response !== null &&
    "_brand" in response &&
    response._brand === "ProviderResponse" &&
    "provider" in response &&
    response.provider === "openai" &&
    "object" in response &&
    response.object === "chat.completion" &&
    "choices" in response &&
    Array.isArray(response.choices) &&
    response.choices.length > 0;

export const isOpenRouterResponse = (response: unknown): response is OpenRouterResponse =>
    typeof response === "object" &&
    response !== null &&
    "_brand" in response &&
    response._brand === "ProviderResponse" &&
    "provider" in response &&
    response.provider === "openrouter";

export const isOllamaResponse = (response: unknown): response is OllamaResponse =>
    typeof response === "object" &&
    response !== null &&
    "_brand" in response &&
    response._brand === "ProviderResponse" &&
    "provider" in response &&
    response.provider === "ollama" &&
    "message" in response &&
    typeof response.message === "object" &&
    response.message !== null &&
    "done" in response &&
    typeof response.done === "boolean";

export const isGoogleResponse = (response: unknown): response is GoogleResponse =>
    typeof response === "object" &&
    response !== null &&
    "_brand" in response &&
    response._brand === "ProviderResponse" &&
    "provider" in response &&
    response.provider === "google" &&
    "candidates" in response &&
    Array.isArray(response.candidates);

// Content type guards
export const isAnthropicTextContent = (
    content: AnthropicContent
): content is AnthropicTextContent => content.type === "text" && "text" in content;

export const isAnthropicToolContent = (
    content: AnthropicContent
): content is AnthropicToolContent =>
    content.type === "tool_use" && "name" in content && "input" in content && "id" in content;

// ============================================================================
// Factory Functions
// ============================================================================

export function createAnthropicResponse(
    input: Omit<AnthropicResponse, "_brand" | "provider">
): AnthropicResponse {
    return {
        _brand: "ProviderResponse",
        provider: "anthropic",
        ...input,
    };
}

export function createOpenAIResponse(
    input: Omit<OpenAIResponse, "_brand" | "provider">
): OpenAIResponse {
    return {
        _brand: "ProviderResponse",
        provider: "openai",
        ...input,
    };
}

export function createOpenRouterResponse(
    input: Omit<OpenRouterResponse, "_brand" | "provider">
): OpenRouterResponse {
    return {
        _brand: "ProviderResponse",
        provider: "openrouter",
        ...input,
    };
}

export function createOllamaResponse(
    input: Omit<OllamaResponse, "_brand" | "provider">
): OllamaResponse {
    return {
        _brand: "ProviderResponse",
        provider: "ollama",
        ...input,
    };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function normalizeProviderUsage(response: ProviderResponse): TokenUsage | undefined {
    if (isAnthropicResponse(response)) {
        return createTokenUsage({
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens,
            cacheCreationTokens: response.usage.cache_creation_input_tokens,
            cacheReadTokens: response.usage.cache_read_input_tokens,
        });
    }

    if (isOpenAIResponse(response) && response.usage) {
        return createTokenUsage({
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
        });
    }

    if (isOpenRouterResponse(response) && response.usage) {
        return createTokenUsage({
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
            cost: response.usage.total_cost,
        });
    }

    if (isOllamaResponse(response)) {
        return createTokenUsage({
            promptTokens: response.prompt_eval_count || 0,
            completionTokens: response.eval_count || 0,
            totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
        });
    }

    if (isGoogleResponse(response) && response.usageMetadata) {
        return createTokenUsage({
            promptTokens: response.usageMetadata.promptTokenCount,
            completionTokens: response.usageMetadata.candidatesTokenCount,
            totalTokens: response.usageMetadata.totalTokenCount,
        });
    }

    return undefined;
}

export function extractProviderContent(response: ProviderResponse): string {
    if (isAnthropicResponse(response)) {
        return response.content
            .filter(isAnthropicTextContent)
            .map((c) => c.text)
            .join("\n");
    }

    if (isOpenAIResponse(response)) {
        return response.choices[0]?.message?.content || "";
    }

    if (isOpenRouterResponse(response)) {
        return response.choices[0]?.message?.content || "";
    }

    if (isOllamaResponse(response)) {
        return response.message.content;
    }

    if (isGoogleResponse(response)) {
        return (
            response.candidates[0]?.content?.parts
                ?.filter((part) => part.text)
                ?.map((part) => part.text)
                ?.join("\n") || ""
        );
    }

    return "";
}

export function extractProviderToolCalls(response: ProviderResponse): Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}> {
    if (isAnthropicResponse(response)) {
        return response.content.filter(isAnthropicToolContent).map((tool) => ({
            id: tool.id,
            name: tool.name,
            arguments: tool.input,
        }));
    }

    if (isOpenAIResponse(response) || isOpenRouterResponse(response)) {
        const toolCalls = response.choices[0]?.message?.tool_calls || [];
        return toolCalls.map((call) => ({
            id: call.id,
            name: call.function.name,
            arguments: JSON.parse(call.function.arguments),
        }));
    }

    if (isOllamaResponse(response)) {
        const toolCalls = response.message.tool_calls || [];
        return toolCalls.map((call) => ({
            id: call.id,
            name: call.function.name,
            arguments: JSON.parse(call.function.arguments),
        }));
    }

    if (isGoogleResponse(response)) {
        return (
            response.candidates[0]?.content?.parts
                ?.filter((part) => part.functionCall)
                ?.map((part, index) => ({
                    id: `google-${index}`,
                    name: part.functionCall!.name,
                    arguments: part.functionCall!.args,
                })) || []
        );
    }

    return [];
}
