/**
 * Tool execution types
 */

/**
 * Tool execution context
 */
export interface ToolContext {
    agent?: unknown; // Agent instance - using unknown to avoid circular dependency
    ndk?: unknown; // NDK instance
    projectInfo?: {
        path: string;
        name?: string;
        naddr?: string;
    };
    user?: {
        pubkey: string;
        npub?: string;
    };
    metadata?: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface ToolResult {
    success: boolean;
    content?: string;
    data?: unknown;
    error?: ToolError;
    metadata?: ToolResultMetadata;
}

/**
 * Tool error
 */
export interface ToolError {
    code: string;
    message: string;
    details?: unknown;
    recoverable?: boolean;
}

/**
 * Tool result metadata
 */
export interface ToolResultMetadata {
    duration?: number; // in milliseconds
    tokensUsed?: number;
    cost?: number;
    cacheHit?: boolean;
    [key: string]: unknown;
}

/**
 * Tool execution request
 */
export interface ToolRequest {
    toolName: string;
    parameters: Record<string, unknown>;
    context?: ToolContext;
    requestId?: string;
    timestamp?: number;
}

/**
 * Tool execution event for logging
 */
export interface ToolExecutionEvent {
    type: "start" | "complete" | "error";
    toolName: string;
    requestId: string;
    timestamp: number;
    duration?: number;
    result?: ToolResult;
    error?: ToolError;
}
