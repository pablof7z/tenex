/**
 * TENEX CLI: Nostr Session Singleton
 * Loads config, sets up NDK singleton and signer, and exports ready-to-use NDK and user info.
 */
import NDK, { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { ConfigManager } from "../config/manager";
import { TenexConfig } from "../types";

// Load config once
const config: TenexConfig | null = ConfigManager.loadConfig();
if (!config || !config.user?.nsec) {
    throw new Error("TENEX CLI: No user nsec found in config. Please initialize your CLI profile.");
}

// Create signer from nsec (nsec or hex supported)
const signer = new NDKPrivateKeySigner(config.user.nsec);

// Create NDK singleton and set signer
const ndk = new NDK({ signer });
ndk.connect();

export { ndk, signer, config };
