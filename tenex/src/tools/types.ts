// Tool parameter types
export type ShellToolParameters = {
    command: string;
};

export type FileReadParameters = {
    path: string;
};

export type FileWriteParameters = {
    path: string;
    content: string;
};

export type FileEditParameters = {
    path: string;
    oldContent: string;
    newContent: string;
};

export type FileToolParameters = FileReadParameters | FileWriteParameters | FileEditParameters;

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

export interface ToolExecutionMetadata {
    exitCode?: number;
    fileSize?: number;
    encoding?: string;
    mimeType?: string;
    duration?: number;
    [key: string]: string | number | boolean | undefined;
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
    metadata?: ToolExecutionMetadata;
}

// Tool definition
export interface Tool {
    name: string;
    instructions: string;
    run: (args: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolResult>;
}

import type { Agent } from "@/agents/types";
import type { Conversation } from "@/conversations/types";

export interface ToolExecutionContext {
    projectPath: string;
    conversationId: string;
    agentName: string;
    phase: string;
    agent: Agent;
    conversation?: Conversation;
}

export interface ToolExecutionResult {
    success: boolean;
    output?: ToolOutput;
    error?: string;
    duration: number;
    metadata?: ToolExecutionMetadata;
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
