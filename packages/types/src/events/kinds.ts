import type { NDKKind } from "@nostr-dev-kit/ndk";

/**
 * Nostr event kinds used in TENEX
 */

export const EVENT_KINDS = {
    // Standard Nostr kinds
    METADATA: 0 as NDKKind,
    TEXT_NOTE: 1 as NDKKind,
    CONTACT_LIST: 3 as NDKKind,

    // Chat-related
    CHAT: 11 as NDKKind,
    THREAD_REPLY: 1111 as NDKKind,

    // TENEX-specific kinds
    TASK: 1934 as NDKKind,
    TASK_UPDATE: 1935 as NDKKind, // Task status update
    AGENT_REQUEST: 3199 as NDKKind,
    AGENT_REQUEST_LIST: 13199 as NDKKind, // List of agent requests (10000 + 3199)
    AGENT_LESSON: 4124 as NDKKind,
    AGENT_CONFIG: 4199 as NDKKind,

    // Status and typing
    PROJECT_STATUS: 24010 as NDKKind,
    LLM_CONFIG_CHANGE: 24101 as NDKKind,
    TYPING_INDICATOR: 24111 as NDKKind,
    TYPING_INDICATOR_STOP: 24112 as NDKKind,

    // Addressable events
    ARTICLE: 30023 as NDKKind,
    TEMPLATE: 30717 as NDKKind,
    PROJECT: 31933 as NDKKind,
} as const;

export type EventKind = (typeof EVENT_KINDS)[keyof typeof EVENT_KINDS];

/**
 * Helper to check if a kind is addressable (30000 <= kind < 40000)
 */
export function isAddressableKind(kind: number): boolean {
    return kind >= 30000 && kind < 40000;
}

/**
 * Helper to check if a kind is replaceable (10000 <= kind < 20000 or kind in [0, 3])
 */
export function isReplaceableKind(kind: number): boolean {
    return (kind >= 10000 && kind < 20000) || kind === 0 || kind === 3;
}

/**
 * Helper to check if a kind is ephemeral (20000 <= kind < 30000)
 */
export function isEphemeralKind(kind: number): boolean {
    return kind >= 20000 && kind < 30000;
}
