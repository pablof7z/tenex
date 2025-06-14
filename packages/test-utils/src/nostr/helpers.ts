import type { NDKFilter } from "@nostr-dev-kit/ndk";

/**
 * Matches an event against a filter
 */
export function eventMatchesFilter(event: { kind?: number; pubkey?: string; id?: string; created_at?: number; tags?: Array<string[]> }, filter: NDKFilter): boolean {
    // Check kinds
    if (filter.kinds && !filter.kinds.includes(event.kind)) {
        return false;
    }

    // Check authors
    if (filter.authors && !filter.authors.includes(event.pubkey)) {
        return false;
    }

    // Check ids
    if (filter.ids && !filter.ids.includes(event.id)) {
        return false;
    }

    // Check tags
    for (const [key, values] of Object.entries(filter)) {
        if (key.startsWith("#")) {
            const tagName = key.slice(1);
            const eventTagValues = event.tags
                .filter((tag: string[]) => tag[0] === tagName)
                .map((tag: string[]) => tag[1]);

            if (!values.some((v: string) => eventTagValues.includes(v))) {
                return false;
            }
        }
    }

    // Check time constraints
    if (filter.since && event.created_at < filter.since) {
        return false;
    }
    if (filter.until && event.created_at > filter.until) {
        return false;
    }

    return true;
}

/**
 * Generates a random hex string for IDs and pubkeys
 */
export function generateRandomHex(length = 64): string {
    const chars = "0123456789abcdef";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

/**
 * Creates a deterministic pubkey from a string (for consistent testing)
 */
export function pubkeyFromString(str: string): string {
    // Simple hash-like function for testing
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to hex and pad to 64 chars
    const hex = Math.abs(hash).toString(16);
    return hex.padEnd(64, "0");
}

/**
 * Waits for a condition to be true
 */
export async function waitFor(
    condition: () => boolean,
    options: { timeout?: number; interval?: number } = {}
): Promise<void> {
    const { timeout = 5000, interval = 50 } = options;
    const startTime = Date.now();

    while (!condition()) {
        if (Date.now() - startTime > timeout) {
            throw new Error("Timeout waiting for condition");
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
}

/**
 * Creates a delay for testing async operations
 */
export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
