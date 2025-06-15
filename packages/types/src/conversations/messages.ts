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
    toolCalls?: Array<{
        id: string;
        type: string;
        function: {
            name: string;
            arguments: string;
        };
    }>; // Tool calls if any
    parent?: string; // Parent message ID for threading
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
    eventId?: string; // Nostr event ID if published
    [key: string]: unknown;
}

export interface ConversationParticipant {
    pubkey: string;
    name: string;
    role: "user" | "agent" | "observer";
    isActive: boolean;
    lastSeen?: number;
}
