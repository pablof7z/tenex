/**
 * Centralized relay configuration for TENEX
 * This eliminates the 5 different relay configurations scattered across the codebase
 */
export declare const DEFAULT_RELAYS: readonly ["wss://relay.damus.io", "wss://relay.primal.net", "wss://relay.nostr.band", "wss://nos.lol"];
export declare const EXTENDED_RELAYS: readonly ["wss://relay.damus.io", "wss://relay.primal.net", "wss://relay.nostr.band", "wss://nos.lol", "wss://purplepag.es"];
export type RelayUrl = (typeof DEFAULT_RELAYS)[number] | (typeof EXTENDED_RELAYS)[number];
/**
 * Get relay configuration based on environment or component needs
 */
export declare function getRelayUrls(extended?: boolean): readonly string[];
//# sourceMappingURL=relays.d.ts.map