/**
 * Chat and messaging event types
 *
 * Note: For actual NDK event classes, use the NDK library directly.
 * These interfaces are for content structures and metadata only.
 */

export interface TypingIndicatorContent {
    conversationId?: string;
    taskId?: string;
    systemPrompt?: string;
    userPrompt?: string;
    message?: string; // e.g., "[agent-codename] is typing..."
}

export interface ChatMetadata {
    conversationId?: string;
    taskId?: string;
    parentId?: string;
    rootId?: string;
    mentions?: string[]; // pubkeys
}

/**
 * Chat event tags structure
 */
export interface ChatEventTags {
    a?: string; // project reference
    agent?: string; // agent name
    parentTaskId?: string; // parent task reference
}

/**
 * Typing indicator event tags
 * Kind: 24111 (typing) / 24112 (stop typing)
 */
export interface TypingIndicatorTags {
    e: string; // conversation/thread ID
    a?: string; // project reference (31933:pubkey:identifier)
    "system-prompt"?: string; // The system prompt being sent to the LLM
    prompt?: string; // The user prompt being sent to the LLM
}
