/**
 * TENEX CLI: NDK Client (Refactored)
 * Only keep actual useful utilities here. All NDK setup is in session.ts.
 */
import NDK, { NDKEvent, NDKPrivateKeySigner, NDKSigner } from "@nostr-dev-kit/ndk";

let ndkInstance: NDK | null = null;

export async function getNDK(): Promise<NDK> {
    if (!ndkInstance) {
        ndkInstance = new NDK({
            explicitRelayUrls: [
                "wss://relay.nostr.band",
                "wss://relay.damus.io",
                "wss://relay.nostr.wirednet.jp",
                "wss://nostr.wine",
            ],
        });
        await ndkInstance.connect();
    }
    return ndkInstance;
}

export const NDKClient = {
    publishEvent: async (nsec: string, eventData: any) => {
        const tempNdk = new NDK({
            signer: new NDKPrivateKeySigner(nsec),
        });
        await tempNdk.connect();
        
        const event = new NDKEvent(tempNdk);
        Object.assign(event, eventData);
        event.publish();
    },
    
    publishStatusUpdate: async (nsec: string, message: string, context?: Record<string, any>) => {
        const tempNdk = new NDK({
            signer: new NDKPrivateKeySigner(nsec),
        });
        await tempNdk.connect();
        
        const event = new NDKEvent(tempNdk);
        event.kind = 1;
        event.content = message;
        event.tags = [];
        
        if (context) {
            for (const [key, value] of Object.entries(context)) {
                event.tags.push([key, String(value)]);
            }
        }
        
        event.publish();
    }
};
