/**
 * Profile and user-related types
 */

// ============================================================================
// Profile Types
// ============================================================================

export interface NostrProfile {
    readonly _brand: "NostrProfile";
    name?: string;
    display_name?: string;
    about?: string;
    picture?: string;
    banner?: string;
    nip05?: string;
    lud16?: string;
    lud06?: string;
    website?: string;
    created_at?: number;
    // Additional fields that might be present
    [key: string]: unknown;
}

export interface ProfileData {
    pubkey: string;
    profile?: NostrProfile;
    fetched: boolean;
    lastUpdated: number;
}

// ============================================================================
// Type Guards
// ============================================================================

export const isNostrProfile = (obj: unknown): obj is NostrProfile =>
    typeof obj === "object" && obj !== null && "_brand" in obj && obj._brand === "NostrProfile";

export const isValidProfileData = (obj: unknown): obj is ProfileData =>
    typeof obj === "object" &&
    obj !== null &&
    "pubkey" in obj &&
    typeof obj.pubkey === "string" &&
    "fetched" in obj &&
    typeof obj.fetched === "boolean" &&
    "lastUpdated" in obj &&
    typeof obj.lastUpdated === "number";

// ============================================================================
// Factory Functions
// ============================================================================

export function createNostrProfile(input: Partial<NostrProfile>): NostrProfile {
    return {
        _brand: "NostrProfile",
        name: input.name,
        display_name: input.display_name,
        about: input.about,
        picture: input.picture,
        banner: input.banner,
        nip05: input.nip05,
        lud16: input.lud16,
        lud06: input.lud06,
        website: input.website,
        created_at: input.created_at,
        ...input,
    };
}

export function createProfileData(pubkey: string, profile?: NostrProfile): ProfileData {
    return {
        pubkey,
        profile,
        fetched: Boolean(profile),
        lastUpdated: Date.now(),
    };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getDisplayName(profile?: NostrProfile): string {
    if (!profile) return "";
    return profile.display_name || profile.name || "";
}

export function getProfileInitials(profile?: NostrProfile): string {
    const displayName = getDisplayName(profile);
    if (!displayName) return "";

    const words = displayName.trim().split(/\s+/);
    if (words.length === 1) {
        return words[0]?.charAt(0).toUpperCase() || "";
    }
    return words
        .slice(0, 2)
        .map((word) => word?.charAt(0).toUpperCase() || "")
        .join("");
}

export function getAvatarUrl(profile?: NostrProfile): string | undefined {
    return profile?.picture;
}

export function isProfileComplete(profile?: NostrProfile): boolean {
    if (!profile) return false;

    const hasBasicInfo = Boolean(profile.name || profile.display_name);
    const hasDescription = Boolean(profile.about);
    const hasAvatar = Boolean(profile.picture);

    return hasBasicInfo && (hasDescription || hasAvatar);
}

// ============================================================================
// Migration Utilities
// ============================================================================

/**
 * Legacy profile input interface
 */
interface LegacyProfileInput {
    name?: unknown;
    display_name?: unknown;
    about?: unknown;
    picture?: unknown;
    banner?: unknown;
    nip05?: unknown;
    lud16?: unknown;
    lud06?: unknown;
    website?: unknown;
    created_at?: unknown;
    [key: string]: unknown;
}

/**
 * Type guard for legacy profile input
 */
function isLegacyProfileInput(obj: unknown): obj is LegacyProfileInput {
    return typeof obj === "object" && obj !== null;
}

export function migrateProfileFromLegacy(input: unknown): NostrProfile {
    if (!isLegacyProfileInput(input)) {
        throw new Error("Invalid profile input format");
    }

    return createNostrProfile({
        name: typeof input.name === "string" ? input.name : undefined,
        display_name: typeof input.display_name === "string" ? input.display_name : undefined,
        about: typeof input.about === "string" ? input.about : undefined,
        picture: typeof input.picture === "string" ? input.picture : undefined,
        banner: typeof input.banner === "string" ? input.banner : undefined,
        nip05: typeof input.nip05 === "string" ? input.nip05 : undefined,
        lud16: typeof input.lud16 === "string" ? input.lud16 : undefined,
        lud06: typeof input.lud06 === "string" ? input.lud06 : undefined,
        website: typeof input.website === "string" ? input.website : undefined,
        created_at: typeof input.created_at === "number" ? input.created_at : undefined,
    });
}
