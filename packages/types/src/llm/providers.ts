/**
 * Provider-specific type definitions
 */

// Anthropic-specific types
export interface AnthropicTool {
    name: string;
    description: string;
    input_schema: {
        type: "object";
        properties: Record<string, any>;
        required?: string[];
    };
}

export interface AnthropicToolUse {
    type: "tool_use";
    id: string;
    name: string;
    input: Record<string, any>;
}

export interface AnthropicTextBlock {
    type: "text";
    text: string;
}

export type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUse;

// OpenAI-specific types
export interface OpenAIFunction {
    name: string;
    description: string;
    parameters: Record<string, any>;
}

export interface OpenAITool {
    type: "function";
    function: OpenAIFunction;
}

export interface OpenAIToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}

// Google-specific types
export interface GoogleFunctionDeclaration {
    name: string;
    description: string;
    parameters: Record<string, any>;
}

export interface GoogleTool {
    functionDeclarations: GoogleFunctionDeclaration[];
}

// Model information
export interface ModelInfo {
    id: string;
    name: string;
    provider: string;
    contextWindow: number;
    maxOutput: number;
    inputCost: number; // per 1M tokens
    outputCost: number; // per 1M tokens
    supportsFunctions: boolean;
    supportsVision: boolean;
    supportsCaching?: boolean;
}
