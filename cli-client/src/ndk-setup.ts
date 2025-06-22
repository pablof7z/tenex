import NDK, { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { logger } from "./logger.js";

// Default Nostr relay URLs for TENEX
const DEFAULT_RELAY_URLS = [
  "wss://relay.damus.io",
  "wss://relay.primal.net", 
  "wss://relay.nostr.band",
  "wss://nos.lol",
  "wss://relay.snort.social"
];

/**
 * Get relay URLs for NDK connection
 */
function getRelayUrls(): string[] {
  // Check environment variable first
  const envRelays = process.env.TENEX_RELAYS;
  if (envRelays) {
    return envRelays.split(',').map(url => url.trim());
  }
  
  return DEFAULT_RELAY_URLS;
}

let ndkInstance: NDK | null = null;

export interface NDKSetupConfig {
    nsec?: string;
    relays?: string[];
}

export async function getNDK(config: NDKSetupConfig = {}): Promise<NDK> {
    if (!ndkInstance) {
        const relays = config.relays || getRelayUrls();

        ndkInstance = new NDK({
            explicitRelayUrls: [...relays],
            outboxRelayUrls: [...relays],
            enableOutboxModel: true,
        });

        if (config.nsec) {
            const signer = new NDKPrivateKeySigner(config.nsec);
            ndkInstance.signer = signer;
        }

        await ndkInstance.connect();
        logger.info(`✅ Connected to ${ndkInstance.pool.connectedRelays().length} relays`);
    }

    return ndkInstance;
}

export function shutdownNDK(): void {
    if (ndkInstance) {
        ndkInstance.pool.disconnect();
        ndkInstance = null;
    }
}
