import NDK from "@nostr-dev-kit/ndk";
let ndkInstance = null;
export async function getNDK() {
    if (!ndkInstance) {
        ndkInstance = new NDK({
            explicitRelayUrls: [
                "wss://relay.damus.io",
                "wss://relay.primal.net",
                "wss://nos.lol",
                "wss://relay.nostr.band",
            ],
        });
        await ndkInstance.connect();
    }
    return ndkInstance;
}
