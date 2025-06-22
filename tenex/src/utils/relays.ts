/**
 * Default Nostr relay URLs for TENEX
 */
const DEFAULT_RELAY_URLS = [
  "wss://relay.primal.net",
];

/**
 * Get relay URLs for NDK connection
 */
export function getRelayUrls(): string[] {
  // Check environment variable first
  const envRelays = process.env.TENEX_RELAYS;
  if (envRelays) {
    return envRelays.split(",").map((url) => url.trim());
  }

  return DEFAULT_RELAY_URLS;
}
