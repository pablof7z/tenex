import NDK from "@nostr-dev-kit/ndk";
import type { Debugger } from "debug";
import createDebug from "debug";
import { getRelayUrls } from "./relays.js";

export interface NDKConfig {
    relays?: readonly string[];
    extended?: boolean;
    debug?: boolean | Debugger;
}

let ndkInstance: NDK | null = null;

/**
 * Unified NDK setup pattern for TENEX
 * Replaces the 4 different NDK initialization patterns across the codebase
 */
export async function getNDK(config: NDKConfig = {}): Promise<NDK> {
    if (!ndkInstance) {
        const relays = config.relays || getRelayUrls(config.extended);

        ndkInstance = new NDK({
            explicitRelayUrls: [...relays],
            debug: typeof config.debug === "boolean" 
                ? (config.debug ? createDebug("ndk") : undefined)
                : config.debug,
        });

        await ndkInstance.connect();
    }
    return ndkInstance;
}

/**
 * Create a new NDK instance (not singleton)
 * Useful when you need a separate instance with different configuration
 */
export async function createNDK(config: NDKConfig = {}): Promise<NDK> {
    const relays = config.relays || getRelayUrls(config.extended);

    const ndk = new NDK({
        explicitRelayUrls: [...relays],
        debug: typeof config.debug === "boolean" 
            ? (config.debug ? createDebug("ndk") : undefined)
            : config.debug,
    });

    await ndk.connect();
    return ndk;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetNDK(): void {
    ndkInstance = null;
}
