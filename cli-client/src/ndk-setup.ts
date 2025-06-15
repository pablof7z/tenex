import NDK, { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { getRelayUrls, logger } from "@tenex/shared";

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
