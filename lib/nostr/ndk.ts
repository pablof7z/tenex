import NDK, { NDKNip07Signer, NDKPrivateKeySigner, NDKSigner } from "@nostr-dev-kit/ndk";
import NDKCacheAdapterDexie from "@nostr-dev-kit/ndk-cache-dexie";

// Define explicit relays or use defaults
const explicitRelayUrls = ["wss://relay.damus.io", "wss://relay.primal.net", "wss://nos.lol", "wss://purplepag.es"];

// Setup Dexie cache adapter (Client-side only)
let cacheAdapter: NDKCacheAdapterDexie | undefined;
if (typeof window !== 'undefined') {
    cacheAdapter = new NDKCacheAdapterDexie({ dbName: "tenex" });
}

// Create the singleton NDK instance
const ndk = new NDK({
    explicitRelayUrls,
    cacheAdapter,
    // You can add other NDK options here if needed
});

// Connect to relays on initialization
// This might be better called within the client component to avoid server-side execution issues,
// but placing it here ensures it's attempted early. Consider moving if problems arise.
ndk.connect().catch((error) => {
    console.error("NDK connection failed:", error);
});

// --- Signer Persistence Logic (Adapted from snippet & expert advice) ---

// Define the structure for serialized signer information
interface SerializedSigner {
    type: "nip07" | "privateKey";
    data?: string; // For privateKey, store the nsec
}

/**
 * Serializes an NDKSigner instance into a storable format.
 * Supports NIP-07 and PrivateKey signers.
 */
export function serializeSigner(signer: NDKSigner): SerializedSigner | null {
    if (signer instanceof NDKNip07Signer) {
        return { type: "nip07" };
    } else if (signer instanceof NDKPrivateKeySigner && signer.privateKey) {
        // IMPORTANT: Handle private key exposure securely.
        // This example stores it directly, which is NOT recommended for production.
        // Consider more secure storage mechanisms or avoiding private key persistence.
        console.warn("Persisting private key directly in localStorage is insecure.");
        return { type: "privateKey", data: signer.privateKey };
    } else {
        console.error("Unsupported signer type for serialization:", signer);
        return null;
    }
}

/**
 * Deserializes stored signer information back into an NDKSigner instance.
 */
export function deserializeSigner(serialized: SerializedSigner): NDKSigner | null {
    if (serialized.type === "nip07") {
        // NIP-07 needs to be re-initialized; the browser extension handles the key.
        return new NDKNip07Signer();
    } else if (serialized.type === "privateKey" && serialized.data) {
        try {
            return new NDKPrivateKeySigner(serialized.data);
        } catch (error) {
            console.error("Failed to deserialize private key signer:", error);
            return null;
        }
    } else {
        console.error("Unsupported signer type for deserialization:", serialized);
        return null;
    }
}

// Export the singleton instance
export default ndk;
