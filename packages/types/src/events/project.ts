/**
 * Project-related event types
 *
 * Note: For actual NDK event classes like NDKArticle (kind 31933),
 * use the NDK library directly. These interfaces are for metadata
 * and content structures only.
 */

export interface ProjectEventMetadata {
    title: string;
    description?: string;
    repo?: string;
    hashtags?: string[];
    agents?: string[]; // Agent event IDs
    template?: string; // Template naddr
}

export interface ProjectStatusContent {
    status: "online" | "offline";
    timestamp: number;
    project: string;
    version?: string;
    agents?: string[];
}
