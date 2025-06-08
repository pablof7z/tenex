import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";

// Test what format the signer returns
const signer = NDKPrivateKeySigner.generate();
console.log("signer.privateKey:", signer.privateKey);
console.log("typeof:", typeof signer.privateKey);
console.log("starts with nsec:", signer.privateKey?.startsWith("nsec"));

// Convert hex to nsec if needed
if (signer.privateKey && !signer.privateKey.startsWith("nsec")) {
    const nsec = nip19.nsecEncode(signer.privateKey);
    console.log("Encoded nsec:", nsec);
}