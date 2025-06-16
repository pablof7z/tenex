/**
 * TENEX CLI: NDK Singleton
 * Manages a single NDK instance for the CLI
 */
import NDK from "@nostr-dev-kit/ndk";
import { getRelayUrls } from "@tenex/shared";

let ndkInstance: NDK | null = null;

export async function getNDK(): Promise<NDK> {
    if (!ndkInstance) {
        const relays = getRelayUrls();

        ndkInstance = new NDK({
            explicitRelayUrls: [...relays],
            enableOutboxModel: true,
            autoConnectUserRelays: true,
            autoFetchUserMutelist: true,
        });

        await ndkInstance.connect();
    }
    return ndkInstance;
}

export async function shutdownNDK(): Promise<void> {
    if (ndkInstance) {
        // Disconnect all relays
        if (ndkInstance.pool?.relays) {
            for (const relay of ndkInstance.pool.relays.values()) {
                relay.disconnect();
            }
        }
        ndkInstance = null;
    }
}
