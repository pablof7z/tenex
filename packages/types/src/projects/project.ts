/**
 * Full project data types for runtime use
 */

/**
 * Agent data combining profile and configuration
 */
export interface Agent {
    name: string;
    display_name?: string;
    description?: string;
    role?: string;
    instructions?: string;
    version?: string;
    eventId?: string;
    nsec: string;
    nip05?: string;
    picture?: string;
    lud16?: string;
    banner?: string;
    website?: string;
}

/**
 * Full project data for runtime operations
 */
export interface ProjectData {
    // Core identifiers
    identifier: string;
    pubkey: string;
    naddr: string;

    // Project metadata
    title: string;
    description?: string;
    repoUrl?: string;
    hashtags?: string[];

    // Agent configuration
    defaultAgent?: string;
    agentEventIds: string[];

    // Timestamps
    createdAt?: number;
    updatedAt?: number;
}
