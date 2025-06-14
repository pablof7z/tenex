/**
 * Centralized relay configuration for TENEX
 * This eliminates the 5 different relay configurations scattered across the codebase
 */
export const DEFAULT_RELAYS = [
    "wss://relay.damus.io",
    "wss://relay.primal.net",
    "wss://relay.nostr.band",
    "wss://nos.lol",
];
export const EXTENDED_RELAYS = [...DEFAULT_RELAYS, "wss://purplepag.es"];
/**
 * Get relay configuration based on environment or component needs
 */
export function getRelayUrls(extended = false) {
    return extended ? EXTENDED_RELAYS : DEFAULT_RELAYS;
}
//# sourceMappingURL=relays.js.map