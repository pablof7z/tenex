import type { NDKUserProfile } from "@nostr-dev-kit/ndk";

export type UserEntry = {
    profile: NDKUserProfile;
    data: string;
};

export interface FindSnippetsParams {
    limit?: number;
    since?: number;
    until?: number;
    authors?: string[];
    languages?: string[];
    tags?: string[];
}

export type CodeSnippet = {
    id: string;
    title: string;
    description: string;
    code: string;
    language: string;
    pubkey: string;
    createdAt: number;
    tags: string[];
};
