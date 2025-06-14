/**
 * LLM message types
 */
export type LLMRole = "system" | "user" | "assistant" | "function" | "tool";
export interface BaseLLMMessage {
    role: LLMRole;
    content: string;
    name?: string;
    timestamp?: number;
}
export interface SystemMessage extends BaseLLMMessage {
    role: "system";
}
export interface UserMessage extends BaseLLMMessage {
    role: "user";
}
export interface AssistantMessage extends BaseLLMMessage {
    role: "assistant";
    tool_calls?: ToolCall[];
}
export interface FunctionMessage extends BaseLLMMessage {
    role: "function";
    name: string;
}
export interface ToolMessage extends BaseLLMMessage {
    role: "tool";
    tool_call_id: string;
}
export type LLMMessage = SystemMessage | UserMessage | AssistantMessage | FunctionMessage | ToolMessage;
/**
 * Extended LLM message with event data
 */
export interface LLMConversationMessage extends BaseLLMMessage {
    event?: any;
    eventId?: string;
}
/**
 * Tool call structure
 */
export interface ToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}
/**
 * Image content for multimodal models
 */
export interface ImageContent {
    type: "image";
    source: {
        type: "base64";
        media_type: string;
        data: string;
    };
}
/**
 * Text content
 */
export interface TextContent {
    type: "text";
    text: string;
}
export type MessageContent = string | (TextContent | ImageContent)[];
//# sourceMappingURL=messages.d.ts.map