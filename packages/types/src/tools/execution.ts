/**
 * Tool execution types
 */

/**
 * Tool execution context
 */
export interface ToolContext {
    agent?: any; // Agent instance - using any to avoid circular dependency
    ndk?: any; // NDK instance
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
    data?: any;
    error?: ToolError;
    metadata?: ToolResultMetadata;
}

/**
 * Tool error
 */
export interface ToolError {
    code: string;
    message: string;
    details?: any;
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
    [key: string]: any;
}

/**
 * Tool execution request
 */
export interface ToolRequest {
    toolName: string;
    parameters: Record<string, any>;
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
