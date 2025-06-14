/**
 * Common error types and utilities
 */

/**
 * Base TENEX error class
 */
export class TenexError extends Error {
    constructor(
        message: string,
        public code: string,
        public context?: any,
        public cause?: Error
    ) {
        super(message);
        this.name = "TenexError";
    }
}

/**
 * Specific error types
 */
export class AgentError extends TenexError {
    constructor(message: string, code: string, context?: any) {
        super(message, code, context);
        this.name = "AgentError";
    }
}

export class ConfigurationError extends TenexError {
    constructor(message: string, code: string, context?: any) {
        super(message, code, context);
        this.name = "ConfigurationError";
    }
}

export class NostrError extends TenexError {
    constructor(message: string, code: string, context?: any) {
        super(message, code, context);
        this.name = "NostrError";
    }
}

export class ToolExecutionError extends TenexError {
    constructor(message: string, code: string, context?: any) {
        super(message, code, context);
        this.name = "ToolExecutionError";
    }
}

/**
 * Error codes
 */
export const ERROR_CODES = {
    // General
    UNKNOWN: "UNKNOWN",
    NOT_FOUND: "NOT_FOUND",
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    VALIDATION_ERROR: "VALIDATION_ERROR",

    // Agent
    AGENT_NOT_FOUND: "AGENT_NOT_FOUND",
    AGENT_CREATION_FAILED: "AGENT_CREATION_FAILED",
    AGENT_COMMUNICATION_FAILED: "AGENT_COMMUNICATION_FAILED",

    // Configuration
    CONFIG_INVALID: "CONFIG_INVALID",
    CONFIG_NOT_FOUND: "CONFIG_NOT_FOUND",
    CONFIG_PARSE_ERROR: "CONFIG_PARSE_ERROR",

    // Nostr
    NOSTR_CONNECTION_FAILED: "NOSTR_CONNECTION_FAILED",
    NOSTR_PUBLISH_FAILED: "NOSTR_PUBLISH_FAILED",
    NOSTR_SUBSCRIPTION_FAILED: "NOSTR_SUBSCRIPTION_FAILED",

    // Tool
    TOOL_NOT_FOUND: "TOOL_NOT_FOUND",
    TOOL_EXECUTION_FAILED: "TOOL_EXECUTION_FAILED",
    TOOL_PARAMETER_INVALID: "TOOL_PARAMETER_INVALID",

    // LLM
    LLM_PROVIDER_ERROR: "LLM_PROVIDER_ERROR",
    LLM_RATE_LIMIT: "LLM_RATE_LIMIT",
    LLM_CONTEXT_OVERFLOW: "LLM_CONTEXT_OVERFLOW",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Type guard to check if a value is an Error instance
 */
export function isError(err: unknown): err is Error {
    return err instanceof Error;
}

/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    return String(err);
}

/**
 * Safely extract error stack from unknown error type
 */
export function getErrorStack(err: unknown): string | undefined {
    if (err instanceof Error) return err.stack;
    return undefined;
}

/**
 * Create a standardized error object from unknown error
 */
export function normalizeError(err: unknown): Error {
    if (err instanceof Error) return err;
    if (typeof err === "string") return new Error(err);
    return new Error(String(err));
}
