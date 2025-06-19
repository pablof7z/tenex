import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";

export function generateNsec(): string {
    const signer = NDKPrivateKeySigner.generate();
    // NDKPrivateKeySigner.generate() returns a signer with privateKey in hex format
    // For now, we'll return the hex private key as NDK handles both nsec and hex
    if (!signer.privateKey) {
        throw new Error("Failed to generate private key");
    }
    return signer.privateKey;
}

export function generateNewKey(): { nsec: string; pubkey: string } {
    const signer = NDKPrivateKeySigner.generate();

    if (!signer.privateKey) {
        throw new Error("Failed to generate private key");
    }

    return {
        nsec: signer.privateKey, // NDK accepts both hex and nsec formats
        pubkey: signer.pubkey,
    };
}

export function getPubkeyFromNsec(nsec: string): string {
    const signer = new NDKPrivateKeySigner(nsec);
    return signer.pubkey;
}

export async function getPubkeyFromNsecAsync(nsec: string): Promise<string> {
    const signer = new NDKPrivateKeySigner(nsec);
    return signer.pubkey;
}
