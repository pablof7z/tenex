/**
 * Conversation message types
 */
export interface ConversationMessage {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
    author?: {
        pubkey: string;
        name?: string;
        isAgent?: boolean;
    };
    metadata?: MessageMetadata;
    toolCalls?: any[];
    parent?: string;
}
export interface MessageMetadata {
    model?: string;
    provider?: string;
    tokens?: {
        prompt: number;
        completion: number;
        total: number;
    };
    cost?: number;
    duration?: number;
    cacheHit?: boolean;
    eventId?: string;
    [key: string]: any;
}
export interface ConversationParticipant {
    pubkey: string;
    name: string;
    role: "user" | "agent" | "observer";
    isActive: boolean;
    lastSeen?: number;
}
//# sourceMappingURL=messages.d.ts.map