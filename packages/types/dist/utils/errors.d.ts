/**
 * Common error types and utilities
 */
/**
 * Base TENEX error class
 */
export declare class TenexError extends Error {
    code: string;
    context?: any | undefined;
    cause?: Error | undefined;
    constructor(message: string, code: string, context?: any | undefined, cause?: Error | undefined);
}
/**
 * Specific error types
 */
export declare class AgentError extends TenexError {
    constructor(message: string, code: string, context?: any);
}
export declare class ConfigurationError extends TenexError {
    constructor(message: string, code: string, context?: any);
}
export declare class NostrError extends TenexError {
    constructor(message: string, code: string, context?: any);
}
export declare class ToolExecutionError extends TenexError {
    constructor(message: string, code: string, context?: any);
}
/**
 * Error codes
 */
export declare const ERROR_CODES: {
    readonly UNKNOWN: "UNKNOWN";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly AGENT_NOT_FOUND: "AGENT_NOT_FOUND";
    readonly AGENT_CREATION_FAILED: "AGENT_CREATION_FAILED";
    readonly AGENT_COMMUNICATION_FAILED: "AGENT_COMMUNICATION_FAILED";
    readonly CONFIG_INVALID: "CONFIG_INVALID";
    readonly CONFIG_NOT_FOUND: "CONFIG_NOT_FOUND";
    readonly CONFIG_PARSE_ERROR: "CONFIG_PARSE_ERROR";
    readonly NOSTR_CONNECTION_FAILED: "NOSTR_CONNECTION_FAILED";
    readonly NOSTR_PUBLISH_FAILED: "NOSTR_PUBLISH_FAILED";
    readonly NOSTR_SUBSCRIPTION_FAILED: "NOSTR_SUBSCRIPTION_FAILED";
    readonly TOOL_NOT_FOUND: "TOOL_NOT_FOUND";
    readonly TOOL_EXECUTION_FAILED: "TOOL_EXECUTION_FAILED";
    readonly TOOL_PARAMETER_INVALID: "TOOL_PARAMETER_INVALID";
    readonly LLM_PROVIDER_ERROR: "LLM_PROVIDER_ERROR";
    readonly LLM_RATE_LIMIT: "LLM_RATE_LIMIT";
    readonly LLM_CONTEXT_OVERFLOW: "LLM_CONTEXT_OVERFLOW";
};
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
/**
 * Type guard to check if a value is an Error instance
 */
export declare function isError(err: unknown): err is Error;
/**
 * Safely extract error message from unknown error type
 */
export declare function getErrorMessage(err: unknown): string;
/**
 * Safely extract error stack from unknown error type
 */
export declare function getErrorStack(err: unknown): string | undefined;
/**
 * Create a standardized error object from unknown error
 */
export declare function normalizeError(err: unknown): Error;
//# sourceMappingURL=errors.d.ts.map