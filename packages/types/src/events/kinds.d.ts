/**
 * Nostr event kinds used in TENEX
 */
export declare const EVENT_KINDS: {
    readonly METADATA: 0;
    readonly TEXT_NOTE: 1;
    readonly CONTACT_LIST: 3;
    readonly CHAT: 11;
    readonly THREAD_REPLY: 1111;
    readonly TASK: 1934;
    readonly AGENT_REQUEST: 3199;
    readonly AGENT_LESSON: 4124;
    readonly AGENT_CONFIG: 4199;
    readonly PROJECT_STATUS: 24010;
    readonly TYPING_INDICATOR: 24111;
    readonly TYPING_INDICATOR_STOP: 24112;
    readonly ARTICLE: 30023;
    readonly TEMPLATE: 30717;
    readonly PROJECT: 31933;
};
export type EventKind = (typeof EVENT_KINDS)[keyof typeof EVENT_KINDS];
/**
 * Helper to check if a kind is addressable (30000 <= kind < 40000)
 */
export declare function isAddressableKind(kind: number): boolean;
/**
 * Helper to check if a kind is replaceable (10000 <= kind < 20000 or kind in [0, 3])
 */
export declare function isReplaceableKind(kind: number): boolean;
/**
 * Helper to check if a kind is ephemeral (20000 <= kind < 30000)
 */
export declare function isEphemeralKind(kind: number): boolean;
//# sourceMappingURL=kinds.d.ts.map