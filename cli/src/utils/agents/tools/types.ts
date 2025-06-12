export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
  properties?: Record<string, ToolParameter>; // For object types
  items?: ToolParameter; // For array types
}

export interface ToolContext {
  updateTypingIndicator?: (message: string) => Promise<void>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  // The function that implements the tool
  execute: (params: Record<string, any>, context?: ToolContext) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResponse {
  tool_call_id: string;
  output: string;
}

// Tool format for different providers
export interface AnthropicToolFormat {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export interface OpenAIToolFormat {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}