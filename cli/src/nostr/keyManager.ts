import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";

export class KeyManager {
    static generateNsec(): string {
        const signer = NDKPrivateKeySigner.generate();
        // NDKPrivateKeySigner.generate() returns a signer with privateKey in hex format
        // For now, we'll return the hex private key as NDK handles both nsec and hex
        return signer.privateKey!;
    }
    
    static generateNewKey(): { nsec: string; pubkey: string } {
        const signer = NDKPrivateKeySigner.generate();
        
        return {
            nsec: signer.privateKey!, // NDK accepts both hex and nsec formats
            pubkey: signer.pubkey,
        };
    }
    
    static getPubkeyFromNsec(nsec: string): string {
        const signer = new NDKPrivateKeySigner(nsec);
        return signer.pubkey;
    }
    
    static async getPubkeyFromNsecAsync(nsec: string): Promise<string> {
        const signer = new NDKPrivateKeySigner(nsec);
        await signer.user();
        return signer.pubkey;
    }
}