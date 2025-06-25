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


// Specific metadata for handoff tool
export interface HandoffMetadata {
    handoff: {
        to: 'user' | string; // 'user' or agent pubkey
        toName: string;
        message?: string;
    }
}

// Specific metadata for phase transition tool
export interface PhaseTransitionMetadata {
    phaseTransition: {
        from: Phase;
        to: Phase;
        message: string;
        reason?: string;
    }
}

// Type guard functions
export function isHandoffMetadata(metadata: any): metadata is HandoffMetadata {
    return metadata?.handoff && 
           typeof metadata.handoff.to === 'string' &&
           typeof metadata.handoff.toName === 'string';
}

export function isPhaseTransitionMetadata(metadata: any): metadata is PhaseTransitionMetadata {
    return metadata?.phaseTransition &&
           typeof metadata.phaseTransition.from === 'string' &&
           typeof metadata.phaseTransition.to === 'string' &&
           typeof metadata.phaseTransition.message === 'string';
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
    metadata?: ToolExecutionMetadata | HandoffMetadata | PhaseTransitionMetadata;
}

// Tool definition
export interface Tool {
    name: string;
    instructions: string;
    run: (args: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolResult>;
}

import type { Agent } from "@/agents/types";
import type { Conversation, Phase } from "@/conversations/types";

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
    metadata?: ToolExecutionMetadata | HandoffMetadata | PhaseTransitionMetadata;
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
