/**
 * Consolidated agent response types with discriminated unions
 */

import type { LLMMetadata } from "./llm";

/**
 * Tool call interface for agent responses
 */
export interface ToolCall {
    readonly _brand: "ToolCall";
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
}

/**
 * Conversation signal for agent coordination
 */
export interface ConversationSignal {
    readonly _brand: "ConversationSignal";
    type: "continue" | "ready_for_transition" | "need_input" | "blocked" | "complete";
    reason?: string;
    suggestedNext?: string;
}

/**
 * Base agent response interface
 */
export interface BaseAgentResponse {
    readonly _brand: "AgentResponse";
    content: string;
    metadata?: LLMMetadata;
}

/**
 * Agent response with tool calling capabilities
 */
export interface ToolCapableAgentResponse extends BaseAgentResponse {
    readonly variant: "tool-capable";
    signal?: ConversationSignal;
    toolCalls?: ToolCall[];
    hasNativeToolCalls?: boolean;
}

/**
 * Agent response with confidence scoring and UI rendering
 */
export interface ConfidenceAgentResponse extends BaseAgentResponse {
    readonly variant: "confidence";
    confidence?: number;
    renderInChat?: {
        type: string;
        data: unknown;
    };
}

/**
 * Discriminated union of all agent response types
 */
export type AgentResponse = ToolCapableAgentResponse | ConfidenceAgentResponse;

/**
 * Type guards for agent responses
 */
export const isToolCapableResponse = (
    response: AgentResponse
): response is ToolCapableAgentResponse => response.variant === "tool-capable";

export const isConfidenceResponse = (
    response: AgentResponse
): response is ConfidenceAgentResponse => response.variant === "confidence";

/**
 * Factory functions for creating agent responses
 */
export function createToolCapableResponse(input: {
    content: string;
    metadata?: LLMMetadata;
    signal?: ConversationSignal;
    toolCalls?: ToolCall[];
    hasNativeToolCalls?: boolean;
}): ToolCapableAgentResponse {
    return {
        _brand: "AgentResponse",
        variant: "tool-capable",
        content: input.content,
        metadata: input.metadata,
        signal: input.signal,
        toolCalls: input.toolCalls,
        hasNativeToolCalls: input.hasNativeToolCalls,
    };
}

export function createConfidenceResponse(input: {
    content: string;
    metadata?: LLMMetadata;
    confidence?: number;
    renderInChat?: {
        type: string;
        data: unknown;
    };
}): ConfidenceAgentResponse {
    return {
        _brand: "AgentResponse",
        variant: "confidence",
        content: input.content,
        metadata: input.metadata,
        confidence: input.confidence,
        renderInChat: input.renderInChat,
    };
}

/**
 * Legacy agent response input interface
 */
interface LegacyAgentResponseInput {
    content: string;
    metadata?: LLMMetadata;
    // Tool-capable fields
    signal?: ConversationSignal;
    toolCalls?: ToolCall[];
    hasNativeToolCalls?: boolean;
    // Confidence fields
    confidence?: number;
    renderInChat?: {
        type: string;
        data: unknown;
    };
}

/**
 * Type guard for legacy agent response input
 */
function isLegacyAgentResponseInput(obj: unknown): obj is LegacyAgentResponseInput {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }

    const candidate = obj as Record<string, unknown>;

    return "content" in candidate && typeof candidate.content === "string";
}

/**
 * Migration utilities for legacy agent response formats
 */
export function migrateLegacyAgentResponse(legacy: unknown): AgentResponse {
    if (!isLegacyAgentResponseInput(legacy)) {
        throw new Error("Invalid legacy agent response format");
    }

    const hasToolCapabilities =
        legacy.toolCalls !== undefined ||
        legacy.hasNativeToolCalls !== undefined ||
        legacy.signal !== undefined;
    const hasConfidenceFeatures =
        legacy.confidence !== undefined || legacy.renderInChat !== undefined;

    // If it has both, prefer tool-capable variant
    if (hasToolCapabilities) {
        return createToolCapableResponse({
            content: legacy.content,
            metadata: legacy.metadata,
            signal: legacy.signal,
            toolCalls: legacy.toolCalls,
            hasNativeToolCalls: legacy.hasNativeToolCalls,
        });
    }
    if (hasConfidenceFeatures) {
        return createConfidenceResponse({
            content: legacy.content,
            metadata: legacy.metadata,
            confidence: legacy.confidence,
            renderInChat: legacy.renderInChat,
        });
    }
    // Default to tool-capable for backward compatibility
    return createToolCapableResponse({
        content: legacy.content,
        metadata: legacy.metadata,
    });
}

/**
 * Utility to extract common properties regardless of variant
 */
export function getAgentResponseCommon(response: AgentResponse): BaseAgentResponse {
    return {
        _brand: "AgentResponse",
        content: response.content,
        metadata: response.metadata,
    };
}
