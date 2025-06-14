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
    message?: string;
}
export interface ChatMetadata {
    conversationId?: string;
    taskId?: string;
    parentId?: string;
    rootId?: string;
    mentions?: string[];
}
/**
 * Chat event tags structure
 */
export interface ChatEventTags {
    a?: string;
    agent?: string;
    parentTaskId?: string;
}
/**
 * Typing indicator event tags
 * Kind: 24111 (typing) / 24112 (stop typing)
 */
export interface TypingIndicatorTags {
    e: string;
    a?: string;
    "system-prompt"?: string;
    prompt?: string;
}
//# sourceMappingURL=chat.d.ts.map