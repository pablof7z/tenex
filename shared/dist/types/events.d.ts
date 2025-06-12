/**
 * Nostr event kinds used throughout TENEX
 */
export declare const EVENT_KINDS: {
    readonly PROFILE: 0;
    readonly STATUS_UPDATE: 1;
    readonly CONTACT_LIST: 3;
    readonly CHAT_MESSAGE: 11;
    readonly CHAT_REPLY: 1111;
    readonly TASK: 1934;
    readonly AGENT_LESSON: 4124;
    readonly AGENT_CONFIG: 4199;
    readonly PROJECT_STATUS: 24010;
    readonly TYPING_INDICATOR: 24111;
    readonly TYPING_INDICATOR_STOP: 24112;
    readonly TEMPLATE: 30717;
    readonly PROJECT: 31933;
};
export type EventKind = (typeof EVENT_KINDS)[keyof typeof EVENT_KINDS];
/**
 * Project status event content
 */
export interface ProjectStatusContent {
    status: "online" | "offline";
    timestamp: number;
    project: string;
}
/**
 * Chat event tags
 */
export interface ChatEventTags {
    a?: string;
    agent?: string;
    parentTaskId?: string;
}
/**
 * Typing indicator event content
 */
export interface TypingIndicatorContent {
    message: string;
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
