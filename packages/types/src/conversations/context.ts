/**
 * Conversation context types
 */

import type { ConversationMessage, ConversationParticipant } from "./messages.js";

export interface ConversationContext {
    id: string;
    type: "task" | "chat" | "thread";
    title?: string;
    description?: string;
    projectNaddr?: string;
    taskId?: string;
    parentId?: string; // For threads
    participants: ConversationParticipant[];
    createdAt: number;
    updatedAt: number;
    metadata?: ConversationMetadata;
}

export interface ConversationMetadata {
    totalMessages: number;
    totalTokens: number;
    totalCost: number;
    lastActivity: number;
    status?: "active" | "completed" | "archived";
    tags?: string[];
    [key: string]: unknown;
}

export interface ConversationState {
    messages: ConversationMessage[];
    context: ConversationContext;
    isTyping?: {
        [pubkey: string]: {
            since: number;
            systemPrompt?: string;
            userPrompt?: string;
        };
    };
}

export interface ConversationStorage {
    conversations: Record<string, ConversationState>;
    processedEvents: Set<string>;
    lastCleanup: number;
}
