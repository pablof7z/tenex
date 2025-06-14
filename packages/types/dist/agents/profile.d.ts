/**
 * Agent profile and metadata types
 */
/**
 * Agent profile for kind:0 events
 */
export interface AgentProfile {
    name: string;
    display_name: string;
    about: string;
    picture: string;
    created_at: number;
    nip05?: string;
    lud06?: string;
    lud16?: string;
    website?: string;
    banner?: string;
}
/**
 * Agent definition from kind:4199 events
 */
export interface AgentDefinition {
    eventId: string;
    name: string;
    description?: string;
    role?: string;
    instructions?: string;
    version?: number;
    publishedAt?: number;
    publisher?: string;
    capabilities?: string[];
    model?: string;
    temperature?: number;
}
/**
 * Agent metadata for runtime use
 */
export interface AgentMetadata {
    id: string;
    name: string;
    slug: string;
    nsec: string;
    pubkey: string;
    profile?: AgentProfile;
    definition?: AgentDefinition;
    isDefault?: boolean;
    createdAt: number;
    lastActive?: number;
}
//# sourceMappingURL=profile.d.ts.map