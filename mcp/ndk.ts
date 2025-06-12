import NDK, {
    NDKPrivateKeySigner,
    type NDKRelay,
    type NDKSigner,
} from "@nostr-dev-kit/ndk";
import type { ConfigData } from "./config"; // Simplified config
import { log } from "./lib/utils/log.js"; // Corrected log import path

// Initialize NDK instance globally
export const ndk = new NDK();

/**
 * Get the initialized NDK instance
 */
export function getNDK(): NDK {
    return ndk;
}

/**
 * Initializes the NDK instance with relays and optionally a private key signer.
 * @param config The configuration object containing relays and optionally a private key.
 */
export async function initNDK(config: ConfigData) {
    log("INFO: Initializing NDK...");

    // Set relays from config
    ndk.explicitRelayUrls = config.relays;
    log(`INFO: Using relays: ${config.relays.join(", ")}`);

    // Configure logging for relay events
    ndk.pool.on("relay:connect", (r: NDKRelay) =>
        log(`INFO: Connected to ${r.url}`)
    );
    ndk.pool.on("relay:disconnect", (r: NDKRelay) =>
        log(`INFO: Disconnected from ${r.url}`)
    );
    ndk.pool.on("relay:connecting", (r: NDKRelay) =>
        log(`INFO: Connecting to ${r.url}`)
    );

    // Set up signer from private key
    try {
        const signer: NDKSigner = new NDKPrivateKeySigner(config.privateKey);
        ndk.signer = signer;
        const user = await signer.user();
        log(`INFO: NDK Signer initialized for user: ${user.npub}`);
    } catch (error) {
        log(
            `ERROR: Failed to initialize NDK signer: ${error instanceof Error ? error.message : String(error)}`
        );
        throw new Error(
            "Failed to initialize NDK signer. Ensure NSEC environment variable is set and is a valid nsec."
        );
    }

    // Connect to relays
    try {
        await ndk.connect();
        log("INFO: NDK connected to relays.");
    } catch (error) {
        log(
            `ERROR: NDK failed to connect to relays: ${error instanceof Error ? error.message : String(error)}`
        );
        // Depending on requirements, you might want to throw here or handle differently
    }
}
