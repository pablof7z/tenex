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
    enum?: any[];
    description?: string;
    default?: any;
    minimum?: number;
    maximum?: number;
    pattern?: string;
    [key: string]: any;
}
/**
 * Tool parameter definition
 */
export interface ToolParameter {
    name: string;
    type: string;
    description: string;
    required?: boolean;
    default?: any;
    enum?: any[];
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
        window: number;
    };
}
/**
 * Tool with execution function
 */
export interface ExecutableTool extends ToolDefinition {
    execute: (params: Record<string, any>, context?: any) => Promise<any> | any;
}
/**
 * Tool categories
 */
export declare enum ToolCategory {
    FileSystem = "filesystem",
    Git = "git",
    Nostr = "nostr",
    Documentation = "documentation",
    Agent = "agent",
    System = "system",
    Development = "development",
    Testing = "testing"
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
//# sourceMappingURL=definitions.d.ts.map