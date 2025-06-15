import { NDKEvent } from "@nostr-dev-kit/ndk";
import type { NDKKind, NostrEvent } from "@nostr-dev-kit/ndk";

/**
 * Builder class for creating test Nostr events
 */
export class EventBuilder {
    private event: Partial<NostrEvent>;

    constructor() {
        this.event = {
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: "",
        };
    }

    withId(id: string): this {
        this.event.id = id;
        return this;
    }

    withPubkey(pubkey: string): this {
        this.event.pubkey = pubkey;
        return this;
    }

    withKind(kind: NDKKind | number): this {
        this.event.kind = kind;
        return this;
    }

    withContent(content: string): this {
        this.event.content = content;
        return this;
    }

    withTag(tagName: string, ...values: string[]): this {
        if (!this.event.tags) this.event.tags = [];
        this.event.tags.push([tagName, ...values]);
        return this;
    }

    withTags(tags: string[][]): this {
        this.event.tags = tags;
        return this;
    }

    withCreatedAt(timestamp: number): this {
        this.event.created_at = timestamp;
        return this;
    }

    withSignature(sig: string): this {
        this.event.sig = sig;
        return this;
    }

    build(): NostrEvent {
        if (!this.event.id) this.event.id = `test-event-${Math.random().toString(36).slice(2)}`;
        if (!this.event.pubkey)
            this.event.pubkey = `test-pubkey-${Math.random().toString(36).slice(2)}`;
        if (this.event.kind === undefined) this.event.kind = 1;
        if (!this.event.sig) this.event.sig = `test-sig-${Math.random().toString(36).slice(2)}`;

        return this.event as NostrEvent;
    }

    buildNDKEvent(ndk?: unknown): NDKEvent {
        const rawEvent = this.build();
        const ndkEvent = new NDKEvent(ndk);
        Object.assign(ndkEvent, rawEvent);
        return ndkEvent;
    }
}

/**
 * Convenience functions for common event types
 */
export const eventBuilders = {
    /**
     * Creates a text note (kind 1)
     */
    textNote: (content: string) => new EventBuilder().withKind(1).withContent(content),

    /**
     * Creates a project event (kind 31933)
     */
    project: (title: string, repo: string) =>
        new EventBuilder()
            .withKind(31933)
            .withTag("d", title.toLowerCase().replace(/\s+/g, "-"))
            .withTag("title", title)
            .withTag("repo", repo),

    /**
     * Creates a task event (kind 1934)
     */
    task: (title: string, content: string) =>
        new EventBuilder().withKind(1934).withTag("title", title).withContent(content),

    /**
     * Creates an agent event (kind 4199)
     */
    agent: (name: string, role: string, instructions: string) =>
        new EventBuilder()
            .withKind(4199)
            .withTag("title", name)
            .withTag("role", role)
            .withTag("instructions", instructions),

    /**
     * Creates a status update event
     */
    statusUpdate: (taskId: string, content: string, confidence?: number) => {
        const builder = new EventBuilder().withKind(1).withTag("e", taskId).withContent(content);

        if (confidence !== undefined) {
            builder.withTag("confidence", confidence.toString());
        }

        return builder;
    },

    /**
     * Creates a typing indicator event (kind 24111)
     */
    typingIndicator: (projectId: string, systemPrompt?: string, userPrompt?: string) => {
        const builder = new EventBuilder().withKind(24111).withTag("a", projectId);

        if (systemPrompt) builder.withTag("system-prompt", systemPrompt);
        if (userPrompt) builder.withTag("prompt", userPrompt);

        return builder;
    },
};
