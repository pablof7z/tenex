/**
 * Nostr event kinds used in TENEX
 */

export const EVENT_KINDS = {
    // Standard Nostr kinds
    METADATA: 0,
    TEXT_NOTE: 1,
    CONTACT_LIST: 3,

    // Chat-related
    CHAT: 11,
    THREAD_REPLY: 1111,

    // TENEX-specific kinds
    TASK: 1934,
    AGENT_REQUEST: 3199,
    AGENT_LESSON: 4124,
    AGENT_CONFIG: 4199,

    // Status and typing
    PROJECT_STATUS: 24010,
    LLM_CONFIG_CHANGE: 24101,
    TYPING_INDICATOR: 24111,
    TYPING_INDICATOR_STOP: 24112,

    // Addressable events
    ARTICLE: 30023,
    TEMPLATE: 30717,
    PROJECT: 31933,
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
