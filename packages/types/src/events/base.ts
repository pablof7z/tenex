/**
 * Base event type definitions
 */

export interface NostrEventTag {
    0: string; // tag name
    1?: string; // first value
    2?: string; // second value
    3?: string; // third value
    [index: number]: string | undefined;
}

export interface BaseNostrEvent {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: NostrEventTag[];
    content: string;
    sig: string;
}

export interface SerializedNDKEvent extends BaseNostrEvent {
    // Additional NDK-specific fields that might be serialized
}

/**
 * Common tag names used in TENEX
 */
export const TAG_NAMES = {
    // References
    EVENT: "e",
    PUBKEY: "p",
    ADDRESS: "a",

    // Identifiers
    IDENTIFIER: "d",

    // Metadata
    TITLE: "title",
    SUMMARY: "summary",
    DESCRIPTION: "description",
    IMAGE: "image",
    THUMB: "thumb",
    PUBLISHED_AT: "published_at",

    // Project-specific
    REPO: "repo",
    TEMPLATE: "template",
    AGENT: "agent",
    URI: "uri",

    // Agent-specific
    ROLE: "role",
    INSTRUCTIONS: "instructions",
    VERSION: "version",

    // Content
    HASHTAG: "t",
    SUBJECT: "subject",

    // Status
    STATUS: "status",
    TASK_ID: "task-id",

    // LLM metadata
    LLM_MODEL: "llm-model",
    LLM_TOKENS: "llm-tokens",
    LLM_COST: "llm-cost",
} as const;

export type TagName = (typeof TAG_NAMES)[keyof typeof TAG_NAMES];

/**
 * Helper to get tag value from event
 */
export function getTagValue(event: BaseNostrEvent, tagName: string, index = 1): string | undefined {
    const tag = event.tags.find((t) => t[0] === tagName);
    return tag ? tag[index] : undefined;
}

/**
 * Helper to get all tag values for a specific tag name
 */
export function getTagValues(event: BaseNostrEvent, tagName: string, index = 1): string[] {
    return event.tags
        .filter((t) => t[0] === tagName)
        .map((t) => t[index])
        .filter((v): v is string => v !== undefined);
}
