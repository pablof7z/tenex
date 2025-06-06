import NDK from "@nostr-dev-kit/ndk";
import NDKCacheAdapterDexie from "@nostr-dev-kit/ndk-cache-dexie";

// Define explicit relays or use defaults
const explicitRelayUrls = ["wss://relay.damus.io", "wss://relay.primal.net", "wss://relay.nostr.band", "wss://purplepag.es"];

// Setup Dexie cache adapter (Client-side only)
let cacheAdapter: NDKCacheAdapterDexie | undefined;
if (typeof window !== "undefined") {
    cacheAdapter = new NDKCacheAdapterDexie({ dbName: "tenex" });
}

// Create the singleton NDK instance
const ndk = new NDK({
    explicitRelayUrls,
    cacheAdapter,
    // You can add other NDK options here if needed
});

// Connect to relays on initialization
ndk.connect();

export default ndk;
