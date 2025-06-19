/**
 * Consolidated conversation and message types with discriminated unions
 */

/**
 * Base message interface
 */
export interface BaseMessage {
    readonly _brand: "Message";
    content: string;
    timestamp?: number;
}

/**
 * System message type
 */
export interface SystemMessage extends BaseMessage {
    readonly role: "system";
    readonly messageType: "system";
}

/**
 * User message type
 */
export interface UserMessage extends BaseMessage {
    readonly role: "user";
    readonly messageType: "user";
}

/**
 * Assistant message type with optional tool calls
 */
export interface AssistantMessage extends BaseMessage {
    readonly role: "assistant";
    readonly messageType: "assistant";
    toolCalls?: Array<{
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    }>;
}

/**
 * Discriminated union of all message types
 */
export type Message = SystemMessage | UserMessage | AssistantMessage;

/**
 * Type guards for messages
 */
export const isSystemMessage = (message: Message): message is SystemMessage =>
    message.role === "system";

export const isUserMessage = (message: Message): message is UserMessage => message.role === "user";

export const isAssistantMessage = (message: Message): message is AssistantMessage =>
    message.role === "assistant";

/**
 * Factory functions for creating messages
 */
export function createSystemMessage(content: string, timestamp?: number): SystemMessage {
    return {
        _brand: "Message",
        role: "system",
        messageType: "system",
        content,
        timestamp,
    };
}

export function createUserMessage(content: string, timestamp?: number): UserMessage {
    return {
        _brand: "Message",
        role: "user",
        messageType: "user",
        content,
        timestamp,
    };
}

export function createAssistantMessage(
    content: string,
    timestamp?: number,
    toolCalls?: Array<{
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    }>
): AssistantMessage {
    return {
        _brand: "Message",
        role: "assistant",
        messageType: "assistant",
        content,
        timestamp,
        toolCalls,
    };
}

/**
 * Legacy message input interface
 */
interface LegacyMessageInput {
    role: "system" | "user" | "assistant";
    content: string;
    timestamp?: number;
    toolCalls?: Array<{
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    }>;
}

/**
 * Type guard for legacy message input
 */
function isLegacyMessageInput(obj: unknown): obj is LegacyMessageInput {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }

    const candidate = obj as Record<string, unknown>;

    return (
        "role" in candidate &&
        typeof candidate.role === "string" &&
        ["system", "user", "assistant"].includes(candidate.role) &&
        "content" in candidate &&
        typeof candidate.content === "string"
    );
}

/**
 * Migration utility for legacy message formats
 */
export function migrateLegacyMessage(legacy: unknown): Message {
    if (!isLegacyMessageInput(legacy)) {
        throw new Error("Invalid legacy message format");
    }

    switch (legacy.role) {
        case "system":
            return createSystemMessage(legacy.content, legacy.timestamp);
        case "user":
            return createUserMessage(legacy.content, legacy.timestamp);
        case "assistant":
            return createAssistantMessage(legacy.content, legacy.timestamp, legacy.toolCalls);
        default:
            throw new Error(`Unknown message role: ${legacy.role}`);
    }
}

/**
 * Conversation context interface
 */
export interface ConversationContext {
    readonly _brand: "ConversationContext";
    id: string;
    participants: string[];
    rootEventId?: string;
    projectId?: string;
    createdAt: number;
    updatedAt: number;
}
