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
  const relaysEnv = process.env.RELAYS;
  if (relaysEnv) {
    return relaysEnv.split(',').map(url => url.trim());
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
        const useExplicitRelays = process.env.RELAYS !== undefined;

        ndkInstance = new NDK({
            explicitRelayUrls: [...relays],
            outboxRelayUrls: [...relays],
            enableOutboxModel: !useExplicitRelays,
        });

        if (config.nsec) {
            const signer = new NDKPrivateKeySigner(config.nsec);
            ndkInstance.signer = signer;
        }

        await ndkInstance.connect();
        
        // Only log if not in JSON mode (check process.argv for --json flag)
        const isJsonMode = process.argv.includes('--json');
        if (!isJsonMode) {
            logger.info(`✅ Connected to ${ndkInstance.pool.connectedRelays().length} relays`);
        }
    }

    return ndkInstance;
}

export function shutdownNDK(): void {
    if (ndkInstance) {
        ndkInstance.pool.disconnect();
        ndkInstance = null;
    }
}
