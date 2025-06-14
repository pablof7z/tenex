import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { ConversationMessage as BaseConversationMessage } from "@tenex/types/conversations";
import type { SerializedNDKEvent } from "@tenex/types/events";

// Re-export types from @tenex/types
export type { LLMConfig } from "@tenex/types/llm";
export type { ConversationContext } from "@tenex/types/conversations";
export type { SerializedNDKEvent } from "@tenex/types/events";

// CLI-specific agent config (extends base definition)
export interface AgentConfig {
    name: string;
    description?: string;
    role?: string;
    instructions?: string;
    systemPrompt?: string;
    version?: string;
}

// Extend base conversation message for CLI needs
export interface ConversationMessage extends BaseConversationMessage {
    event?: NDKEvent | SerializedNDKEvent; // NDKEvent when in memory, raw event object when serialized
}

export interface AgentResponseMetadata {
    model?: string;
    provider?: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
        cost?: number;
    };
    systemPrompt?: string;
    userPrompt?: string;
    // Additional metadata should be specifically typed rather than using [key: string]: unknown
    temperature?: number;
    maxTokens?: number;
    toolCalls?: number;
}

export interface AgentResponse {
    content: string;
    confidence?: number;
    metadata?: AgentResponseMetadata;
}
