import type { NDK, NDKProject } from "@nostr-dev-kit/ndk";
import type { Agent } from "../Agent";
import type { ToolCall } from "../tools/types";
import type { LLMConfig } from "../types";

export interface LLMMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}

export interface LLMResponse {
    content: string;
    model?: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        cache_creation_input_tokens?: number; // Anthropic cache creation
        cache_read_input_tokens?: number; // Anthropic cache reads
        cost?: number; // Total cost in USD
    };
}

export interface LLMContext {
    agentName?: string;
    projectName?: string;
    conversationId?: string;
    typingIndicator?: (message: string) => Promise<void>;
    agent?: Agent; // The Agent instance
    ndk: NDK; // The NDK instance - REQUIRED
    agentEventId?: string; // The NDKAgent event ID
    projectEvent: NDKProject; // The project event (kind 31933) - REQUIRED
}

// Provider-specific tool formats
export interface AnthropicTool {
    name: string;
    description: string;
    input_schema: {
        type: "object";
        properties: Record<string, unknown>;
        required: string[];
    };
}

export interface OpenAITool {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, unknown>;
            required: string[];
        };
    };
}

export type ProviderTool = AnthropicTool | OpenAITool;

export interface LLMProvider {
    generateResponse(
        messages: LLMMessage[],
        config: LLMConfig,
        context?: LLMContext,
        tools?: ProviderTool[] // Provider-specific tool format
    ): Promise<LLMResponse>;
}
