/**
 * TENEX CLI: NDK Singleton
 * Manages a single NDK instance for the CLI
 */
import NDK from "@nostr-dev-kit/ndk";
import { getRelayUrls } from "@tenex/shared";

let ndk: NDK;

export async function initNDK(): Promise<void> {
    if (ndk) {
        // Disconnect existing instance
        if (ndk.pool?.relays) {
            for (const relay of ndk.pool.relays.values()) {
                relay.disconnect();
            }
        }
    }

    const relays = getRelayUrls();
    ndk = new NDK({
        explicitRelayUrls: [...relays],
        enableOutboxModel: true,
        autoConnectUserRelays: true,
        autoFetchUserMutelist: true,
    });

    await ndk.connect();
}

export function getNDK(): NDK {
    if (!ndk) {
        throw new Error("NDK not initialized. Call initNDK() first.");
    }
    return ndk;
}

// Direct access to NDK singleton (throws if not initialized)
export { ndk };

export async function shutdownNDK(): Promise<void> {
    if (ndk) {
        // Disconnect all relays
        if (ndk.pool?.relays) {
            for (const relay of ndk.pool.relays.values()) {
                relay.disconnect();
            }
        }
        ndk = undefined as any;
    }
}

// For testing
export function __setNDK(mockNdk: NDK): void {
    ndk = mockNdk;
}
