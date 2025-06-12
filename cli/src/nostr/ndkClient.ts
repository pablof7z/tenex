/**
 * TENEX CLI: NDK Client (Refactored)
 * Only keep actual useful utilities here. All NDK setup is in session.ts.
 */
import NDK, {
	NDKEvent,
	NDKPrivateKeySigner,
	NDKSigner,
} from "@nostr-dev-kit/ndk";

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

export const NDKClient = {
	publishEvent: async (nsec: string, eventData: any) => {
		const ndk = await getNDK();
		const signer = new NDKPrivateKeySigner(nsec);

		const event = new NDKEvent(ndk);
		Object.assign(event, eventData);
		event.ndk = ndk;
		await event.sign(signer);
		await event.publish();
	},

	publishStatusUpdate: async (
		nsec: string,
		message: string,
		context?: Record<string, any>,
	) => {
		const ndk = await getNDK();
		const signer = new NDKPrivateKeySigner(nsec);

		const event = new NDKEvent(ndk);
		event.kind = 1;
		event.content = message;
		event.tags = [];

		if (context) {
			for (const [key, value] of Object.entries(context)) {
				event.tags.push([key, String(value)]);
			}
		}

		event.ndk = ndk;
		await event.sign(signer);
		await event.publish();
	},
};
