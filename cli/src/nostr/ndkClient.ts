/**
 * TENEX CLI: NDK Utilities
 * Provides singleton NDK instance management
 */
import NDK from "@nostr-dev-kit/ndk";

let ndkInstance: NDK | null = null;

export async function getNDK(): Promise<NDK> {
	if (!ndkInstance) {
		ndkInstance = new NDK({
			explicitRelayUrls: [
				"wss://relay.nostr.band",
				"wss://relay.damus.io",
				"wss://relay.primal.net",
			],
		});
		await ndkInstance.connect();
	}
	return ndkInstance;
}

export async function shutdownNDK(): Promise<void> {
	if (ndkInstance) {
		// NDK doesn't have a built-in disconnect method, but we can
		// stop all subscriptions and clear the instance
		ndkInstance = null;
	}
}
