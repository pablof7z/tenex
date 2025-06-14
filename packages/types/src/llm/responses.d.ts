/**
 * LLM response types
 */
import type { ToolCall } from "./messages.js";
export interface LLMResponse {
    content: string;
    toolCalls?: ToolCall[];
    usage?: LLMUsage;
    model?: string;
    stopReason?: string;
    metadata?: Record<string, unknown>;
}
export interface LLMUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
}
export interface LLMError {
    code: string;
    message: string;
    details?: unknown;
}
/**
 * Streaming response chunk
 */
export interface LLMStreamChunk {
    type: "content" | "tool_call" | "usage" | "error" | "done";
    content?: string;
    toolCall?: Partial<ToolCall>;
    usage?: LLMUsage;
    error?: LLMError;
}
//# sourceMappingURL=responses.d.ts.map