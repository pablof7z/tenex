import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent, type NDKRawEvent } from "@nostr-dev-kit/ndk";

export class NDKLLMRule extends NDKEvent {
    static kind = 1339;

    constructor(ndk: NDK, event?: NDKEvent | NDKRawEvent) {
        super(ndk, event);
        this.kind = 1339;
    }

    static from(event: NDKEvent): NDKLLMRule {
        return new NDKLLMRule(event.ndk!, event);
    }

    get title(): string {
        return this.tagValue("title") || "Untitled Rule";
    }

    set title(value: string) {
        this.removeTag("title");
        this.tags.push(["title", value]);
    }

    get description(): string {
        return this.tagValue("description") || "";
    }

    set description(value: string) {
        this.removeTag("description");
        if (value) this.tags.push(["description", value]);
    }

    get version(): string {
        return this.tagValue("ver") || "1";
    }

    set version(value: string) {
        this.removeTag("ver");
        this.tags.push(["ver", value]);
    }

    get hashtags(): string[] {
        return this.tags
            .filter((tag) => tag[0] === "t")
            .map((tag) => tag[1])
            .filter(Boolean);
    }

    set hashtags(values: string[]) {
        this.tags = this.tags.filter((tag) => tag[0] !== "t");
        values.forEach((hashtag) => {
            if (hashtag) this.tags.push(["t", hashtag]);
        });
    }

    get ruleContent(): string {
        return this.content;
    }

    set ruleContent(value: string) {
        this.content = value;
    }
}
