/**
 * LLM provider types
 */
export type LLMProvider = "anthropic" | "openai" | "openrouter" | "ollama" | "groq";
/**
 * LLM configuration
 */
export interface LLMConfig {
    provider: LLMProvider | string;
    model: string;
    apiKey?: string;
    baseURL?: string;
    temperature?: number;
    maxTokens?: number;
    enableCaching?: boolean;
    contextWindowSize?: number;
}
/**
 * Message format for LLM conversations
 */
export interface LLMMessage {
    role: "system" | "user" | "assistant";
    content: string;
    timestamp?: number;
}
/**
 * Extended conversation message with event data
 */
export interface ConversationMessage extends LLMMessage {
    event?: any;
    eventId?: string;
}
/**
 * LLM response metadata
 */
export interface LLMResponse {
    content: string;
    usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
    };
    model?: string;
    cached?: boolean;
}
