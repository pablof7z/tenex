// Tool parameter types
export type ShellToolParameters = {
    command: string;
};

export type FileReadParameters = {
    path: string;
};

export type FileToolParameters = FileReadParameters;

export type ClaudeCodeToolParameters = {
    mode: "run" | "plan";
    prompt: string;
};

export type ToolParameters =
    | ShellToolParameters
    | FileToolParameters
    | ClaudeCodeToolParameters
    | Record<string, string | number | boolean>;

// Tool execution result types
export type ToolOutput =
    | string // Command output, file content
    | number // Exit codes, file sizes
    | boolean // Success flags
    | object // Structured data
    | null;

// Continue tool metadata - replaces both HandoffMetadata and PhaseTransitionMetadata
export interface ContinueMetadata {
    routingDecision: {
        phase?: Phase;
        destination: string;     // Agent pubkey or "user"
        destinationName: string; // Human-readable name
        reason: string;
        message: string;
    };
}

// Complete tool metadata
export interface CompleteMetadata {
    completion: {
        response: string;
        nextAgent: string; // PM pubkey or "user"
    };
}

// Type guard functions
export function isContinueMetadata(metadata: unknown): metadata is ContinueMetadata {
    return (
        metadata !== null &&
        typeof metadata === "object" &&
        "routingDecision" in metadata &&
        metadata.routingDecision !== null &&
        typeof metadata.routingDecision === "object" &&
        "destination" in metadata.routingDecision &&
        typeof metadata.routingDecision.destination === "string" &&
        "destinationName" in metadata.routingDecision &&
        typeof metadata.routingDecision.destinationName === "string" &&
        "reason" in metadata.routingDecision &&
        typeof metadata.routingDecision.reason === "string" &&
        "message" in metadata.routingDecision &&
        typeof metadata.routingDecision.message === "string"
    );
}

export function isCompleteMetadata(metadata: unknown): metadata is CompleteMetadata {
    return (
        metadata !== null &&
        typeof metadata === "object" &&
        "completion" in metadata &&
        metadata.completion !== null &&
        typeof metadata.completion === "object" &&
        "response" in metadata.completion &&
        typeof metadata.completion.response === "string" &&
        "nextAgent" in metadata.completion &&
        typeof metadata.completion.nextAgent === "string"
    );
}

// Generic metadata interface for other tools
export interface ToolExecutionMetadata {
    exitCode?: number;
    fileSize?: number;
    encoding?: string;
    mimeType?: string;
    duration?: number;
    [key: string]: string | number | boolean | undefined | object;
}

export interface ToolInvocation {
    toolName: string;
    action: string;
    parameters: ToolParameters;
    rawMatch: string;
}

// Tool execution result
export interface ToolResult {
    success: boolean;
    output?: string;
    error?: string;
    metadata?: ToolExecutionMetadata | ContinueMetadata | CompleteMetadata;
}

// Plugin parameter type from multi-llm-ts
export interface PluginParameter {
    name: string;
    type: "string" | "number" | "boolean" | "object" | "array";
    description: string;
    required?: boolean;
    enum?: string[];
    items?: PluginParameter; // For arrays
    properties?: Record<string, PluginParameter>; // For objects
}

// Tool definition with structured parameters for native function calling
export interface Tool {
    name: string;
    description: string;
    parameters: PluginParameter[];
    execute: (
        params: Record<string, unknown>,
        context: ToolExecutionContext
    ) => Promise<ToolResult>;
}

import type { Agent } from "@/agents/types";
import type { Conversation } from "@/conversations/types";
import type { Phase } from "@/conversations/phases";
import type { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";

export interface ToolExecutionContext {
    projectPath: string;
    conversationId: string;
    phase: string;
    agent: Agent;
    conversation?: Conversation;
    agentSigner?: NDKPrivateKeySigner; // NDK signer for the agent
    conversationRootEventId?: string; // Root event ID for task tagging
}

export interface ToolExecutionResult {
    success: boolean;
    output?: ToolOutput;
    error?: string;
    duration: number;
    metadata?: ToolExecutionMetadata | ContinueMetadata | CompleteMetadata;
    toolName?: string;
}

export interface ToolExecutor {
    name: string;
    execute(
        invocation: ToolInvocation,
        context: ToolExecutionContext
    ): Promise<ToolExecutionResult>;
    canExecute(toolName: string): boolean;
}

export interface ToolPattern {
    pattern: RegExp;
    parser: (match: RegExpMatchArray) => ToolInvocation | null;
}
