import { NDKEvent } from "@nostr-dev-kit/ndk";

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
    /** Template name from 'name' tag */
    name: string;
    /** Template description from 'description' tag */
    description: string;
    /** Template preview image URL from 'image' tag */
    image?: string;
    /** Template tags from 't' tags */
    tags: string[];
    /** Git repository URL from event content */
    repoUrl: string;
    /** Author's pubkey */
    authorPubkey: string;
    /** Event creation timestamp */
    createdAt: number;
    /** Original NDK event */
    event: NDKEvent;
}

/**
 * Raw template event structure for reference
 */
export interface TemplateEventStructure {
    kind: 30717;
    tags: [
        ["d", string], // template identifier
        ["name", string], // template name
        ["description", string], // template description
        ["image", string], // optional image URL
        ...["t", string][], // template tags
    ];
    content: string; // git repository URL (git+https://...)
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
