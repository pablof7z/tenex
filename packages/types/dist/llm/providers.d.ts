/**
 * Provider-specific type definitions
 */
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
export interface GoogleFunctionDeclaration {
    name: string;
    description: string;
    parameters: Record<string, any>;
}
export interface GoogleTool {
    functionDeclarations: GoogleFunctionDeclaration[];
}
export interface ModelInfo {
    id: string;
    name: string;
    provider: string;
    contextWindow: number;
    maxOutput: number;
    inputCost: number;
    outputCost: number;
    supportsFunctions: boolean;
    supportsVision: boolean;
    supportsCaching?: boolean;
}
//# sourceMappingURL=providers.d.ts.map