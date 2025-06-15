import { NDKEvent, type NDKRawEvent } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";

export class NDKLLMRule extends NDKEvent {
    static kind = 1339;
    static kinds = [1339];

    constructor(ndk?: NDK, event?: NDKEvent | NDKRawEvent) {
        super(ndk, event);
        this.kind ??= 1339;
    }

    static from(event: NDKEvent): NDKLLMRule {
        return new NDKLLMRule(event.ndk, event);
    }

    get title(): string | undefined {
        return this.tagValue("title");
    }

    set title(value: string | undefined) {
        this.removeTag("title");
        if (value) this.tags.push(["title", value]);
    }

    get description(): string | undefined {
        return this.tagValue("description");
    }

    set description(value: string | undefined) {
        this.removeTag("description");
        if (value) this.tags.push(["description", value]);
    }

    get version(): string | undefined {
        return this.tagValue("ver");
    }

    set version(value: string | undefined) {
        this.removeTag("ver");
        if (value) this.tags.push(["ver", value]);
    }

    get hashtags(): string[] {
        return this.getMatchingTags("t")
            .map((tag) => tag[1])
            .filter(Boolean) as string[];
    }

    set hashtags(tags: string[]) {
        // Remove all existing t tags
        this.tags = this.tags.filter((tag) => tag[0] !== "t");
        // Add new t tags
        for (const tag of tags) {
            this.tags.push(["t", tag]);
        }
    }
}
