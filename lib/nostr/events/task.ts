import NDK, { NDKEvent, NDKRawEvent } from "@nostr-dev-kit/ndk";
import { NDKProject } from "./project";

/**
 * Represents a task associated with a project.
 */
export class NDKTask extends NDKEvent {
    static kind = 1934;

    constructor(ndk: NDK, event?: NDKEvent | NDKRawEvent) {
        super(ndk, event);
        this.kind = 1934;
    }

    static from(event: NDKEvent): NDKTask {
        return new NDKTask(event.ndk!, event);
    }

    set title(value: string) {
        this.removeTag("title");
        if (value) this.tags.push(["title", value]);
    }

    get title(): string | undefined {
        return this.tagValue("title");
    }

    set project(project: NDKProject) {
        this.removeTag("a");
        this.tags.push(project.tagReference()); // we use this to only get the 'a' tag, no need for e or p tags
    }
}
