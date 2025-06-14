import NDK, { NDKNip07Signer, NDKPrivateKeySigner, type NDKEvent, type NDKFilter } from "@nostr-dev-kit/ndk";

export interface NDKSetupConfig {
    nsec?: string;
    relays?: string[];
}

export const DEFAULT_RELAYS = ["wss://relay.damus.io", "wss://relay.nostr.band"];

export class TenexNDK {
    public ndk: NDK;
    private signer?: NDKPrivateKeySigner;

    constructor(config: NDKSetupConfig = {}) {
        const relays = config.relays || DEFAULT_RELAYS;

        this.ndk = new NDK({
            explicitRelayUrls: relays,
            outboxRelayUrls: relays,
            enableOutboxModel: true,
        });

        if (config.nsec) {
            this.signer = new NDKPrivateKeySigner(config.nsec);
            this.ndk.signer = this.signer;
        }
    }

    async connect(): Promise<void> {
        try {
            await this.ndk.connect();
            console.log(`✅ Connected to ${this.ndk.pool.connectedRelays().length} relays`);
        } catch (error) {
            console.error("❌ Failed to connect to NDK:", error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        this.ndk.pool.disconnect();
    }

    getCurrentUser() {
        return this.ndk.activeUser;
    }

    async subscribe(filters: NDKFilter[], callback: (event: NDKEvent) => void) {
        const subscription = this.ndk.subscribe(filters, { closeOnEose: false });

        subscription.on("event", callback);
        subscription.on("eose", () => {
            console.log("📡 Subscription established");
        });

        return subscription;
    }

    async publishEvent(event: NDKEvent): Promise<void> {
        try {
            await event.sign();
            await event.publish();
            console.log(`📤 Published event: ${event.kind} - ${event.id}`);
        } catch (error) {
            console.error("❌ Failed to publish event:", error);
            throw error;
        }
    }
}
