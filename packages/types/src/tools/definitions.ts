/**
 * Tool definition types
 */

/**
 * JSON Schema for tool parameters
 */
export interface JSONSchema {
    type: string;
    properties?: Record<string, JSONSchema>;
    items?: JSONSchema;
    required?: string[];
    enum?: unknown[];
    description?: string;
    default?: unknown;
    minimum?: number;
    maximum?: number;
    pattern?: string;
    [key: string]: unknown;
}

/**
 * Tool parameter definition
 */
export interface ToolParameter {
    name: string;
    type: string;
    description: string;
    required?: boolean;
    default?: unknown;
    enum?: unknown[];
    schema?: JSONSchema;
}

/**
 * Base tool definition
 */
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: ToolParameter[];
    category?: string;
    isAsync?: boolean;
    requiresAuth?: boolean;
    rateLimit?: {
        requests: number;
        window: number; // in seconds
    };
}

/**
 * Tool with execution function
 */
export interface ExecutableTool extends ToolDefinition {
    execute: (params: Record<string, unknown>, context?: unknown) => Promise<unknown> | unknown;
}

/**
 * Tool categories
 */
export enum ToolCategory {
    FileSystem = "filesystem",
    Git = "git",
    Nostr = "nostr",
    Documentation = "documentation",
    Agent = "agent",
    System = "system",
    Development = "development",
    Testing = "testing",
}

/**
 * Tool metadata for registration
 */
export interface ToolMetadata {
    id: string;
    name: string;
    version: string;
    author?: string;
    description?: string;
    tags?: string[];
}
