import NDK, { NDKArticle, NDKEvent, NDKPrivateKeySigner, NDKRawEvent } from "@nostr-dev-kit/ndk";

export class NDKProject extends NDKArticle {
    static kind = 31933;
    private _signer: NDKPrivateKeySigner | undefined;

    constructor(ndk: NDK, event?: NDKEvent | NDKRawEvent) {
        super(ndk, event);
        this.kind = 31933;
    }

    static from(event: NDKEvent): NDKProject {
        return new NDKProject(event.ndk!, event);
    }

    get tagline(): string | undefined {
        return this.tagValue("tagline");
    }

    set tagline(value: string | undefined) {
        this.removeTag("tagline");
        if (value) this.tags.push(["tagline", value]);
    }

    set repo(value: string | undefined) {
        this.removeTag("repo");
        if (value) this.tags.push(["repo", value]);
    }

    set hashtags(values: string[]) {
        this.removeTag("hashtags");
        if (values.length) this.tags.push(["hashtags", ...values]);
    }

    get hashtags(): string[] {
        const tag = this.tags.find((tag) => tag[0] === "hashtags");
        return tag ? tag.slice(1) : [];
    }
    
    get repo(): string | undefined {
        return this.tagValue("repo");
    }

    set description(value: string) { this.content = value; }
    get description(): string { return this.content; }

    public async getSigner(): Promise<NDKPrivateKeySigner> {
        if (this._signer) return this._signer;

        const encryptedKey = this.tagValue("key");
        if (!encryptedKey) {
            this._signer = NDKPrivateKeySigner.generate();
        } else {
            const decryptedKey = await this.ndk?.signer?.decrypt(this.ndk.activeUser!, encryptedKey);
            if (!decryptedKey) {
                throw new Error("Failed to decrypt project key or missing signer context.");
            }
            this._signer = new NDKPrivateKeySigner(decryptedKey, this.ndk);
        }

        return this._signer;
    }
}
