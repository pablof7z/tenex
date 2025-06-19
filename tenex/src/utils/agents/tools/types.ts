import type { Agent } from "@/agents/domain/Agent";
import type { NDKProject } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";

export interface ToolParameter {
    name: string;
    type: "string" | "number" | "boolean" | "object" | "array";
    description: string;
    required?: boolean;
    enum?: string[];
    properties?: Record<string, ToolParameter>; // For object types
    items?: ToolParameter; // For array types
}

export interface ToolContext {
    updateTypingIndicator?: (message: string) => Promise<void>;
    agentName?: string;
    projectName?: string;
    rootEventId?: string;
    agent?: Agent; // The Agent instance
    ndk: NDK; // The NDK instance - REQUIRED
    agentEventId?: string; // The NDKAgent event ID
    projectEvent: NDKProject; // The project event (kind 31933) - REQUIRED
    eventId?: string; // Event ID that triggered the tool execution
    publisher?: import("../core/types").NostrPublisher; // NostrPublisher instance for proper response publishing
}

// Type-safe tool parameters
export type ToolParameters = Record<string, unknown>;

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: ToolParameter[];
    // The function that implements the tool
    execute: (params: ToolParameters, context?: ToolContext) => Promise<ToolResult>;
}

export interface ToolResult {
    success: boolean;
    output: string;
    error?: string;
}

export interface ToolCall {
    id: string;
    name: string;
    arguments: ToolParameters;
}

export interface ToolResponse {
    tool_call_id: string;
    output: string;
    renderInChat?: {
        type: string;
        data: unknown;
    };
}

// JSON Schema types for tool parameters
export interface JSONSchema {
    type: string;
    description?: string;
    enum?: string[];
    properties?: Record<string, JSONSchema>;
    items?: JSONSchema;
    required?: string[];
    additionalProperties?: boolean;
}

// Tool format for different providers
export interface AnthropicToolFormat {
    name: string;
    description: string;
    input_schema: {
        type: "object";
        properties: Record<string, JSONSchema>;
        required: string[];
    };
}

export interface OpenAIToolFormat {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, JSONSchema>;
            required: string[];
        };
    };
}
