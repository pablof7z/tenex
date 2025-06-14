/**
 * Base event type definitions
 */
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
};
/**
 * Helper to get tag value from event
 */
export function getTagValue(event, tagName, index = 1) {
    const tag = event.tags.find((t) => t[0] === tagName);
    return tag ? tag[index] : undefined;
}
/**
 * Helper to get all tag values for a specific tag name
 */
export function getTagValues(event, tagName, index = 1) {
    return event.tags
        .filter((t) => t[0] === tagName)
        .map((t) => t[index])
        .filter((v) => v !== undefined);
}
//# sourceMappingURL=base.js.map