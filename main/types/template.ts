import type { NDKEvent } from "@nostr-dev-kit/ndk";

/**
 * Template event kind for nostr templates
 */
export const TEMPLATE_KIND = 30717;

/**
 * Parsed template data from nostr event
 */
export interface NostrTemplate {
    /** Unique template identifier from 'd' tag */
    id: string;
    /** Template name from 'title' tag */
    name: string;
    /** Template description from 'description' tag */
    description: string;
    /** Template preview image URL from 'image' tag */
    image?: string;
    /** Template tags from 't' tags */
    tags: string[];
    /** Git repository URL from 'uri' tag */
    repoUrl: string;
    /** Command to run from 'command' tag */
    command?: string;
    /** Agent configuration from 'agent' tag */
    agent?: object;
    /** Template content (usually markdown) */
    content?: string;
    /** Author's pubkey */
    authorPubkey: string;
    /** Event creation timestamp */
    createdAt: number;
    /** Original NDK event */
    event: NDKEvent;
    /** Template naddr (bech32 encoded) */
    naddr: string;
}

/**
 * Raw template event structure for reference
 */
export interface TemplateEventStructure {
    kind: 30717;
    tags: [
        ["d", string], // template identifier
        ["title", string], // template name
        ["description", string], // template description
        ["uri", string], // git repository URL (git+https://...)
        ["image", string], // optional image URL
        ["command", string], // optional command to run
        ["agent", string], // optional agent configuration JSON
        ...["t", string][], // template tags
    ];
    content: string; // markdown content
    created_at: number;
    pubkey: string;
}

/**
 * Template selection state for UI components
 */
export interface TemplateSelection {
    template: NostrTemplate | null;
    isSelected: boolean;
}

/**
 * Template filter options
 */
export interface TemplateFilters {
    /** Filter by specific tags */
    tags?: string[];
    /** Filter by author pubkey */
    author?: string;
    /** Search term for name/description */
    search?: string;
}
