/**
 * Base event type definitions
 */
export interface NostrEventTag {
    0: string;
    1?: string;
    2?: string;
    3?: string;
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
}
/**
 * Common tag names used in TENEX
 */
export declare const TAG_NAMES: {
    readonly EVENT: "e";
    readonly PUBKEY: "p";
    readonly ADDRESS: "a";
    readonly IDENTIFIER: "d";
    readonly TITLE: "title";
    readonly SUMMARY: "summary";
    readonly DESCRIPTION: "description";
    readonly IMAGE: "image";
    readonly THUMB: "thumb";
    readonly PUBLISHED_AT: "published_at";
    readonly REPO: "repo";
    readonly TEMPLATE: "template";
    readonly AGENT: "agent";
    readonly URI: "uri";
    readonly ROLE: "role";
    readonly INSTRUCTIONS: "instructions";
    readonly VERSION: "version";
    readonly HASHTAG: "t";
    readonly SUBJECT: "subject";
    readonly STATUS: "status";
    readonly TASK_ID: "task-id";
    readonly LLM_MODEL: "llm-model";
    readonly LLM_TOKENS: "llm-tokens";
    readonly LLM_COST: "llm-cost";
};
export type TagName = (typeof TAG_NAMES)[keyof typeof TAG_NAMES];
/**
 * Helper to get tag value from event
 */
export declare function getTagValue(event: BaseNostrEvent, tagName: string, index?: number): string | undefined;
/**
 * Helper to get all tag values for a specific tag name
 */
export declare function getTagValues(event: BaseNostrEvent, tagName: string, index?: number): string[];
//# sourceMappingURL=base.d.ts.map