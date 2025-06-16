import type { NDKEvent } from "@nostr-dev-kit/ndk";

export function getTag(event: NDKEvent, tagName: string): string | undefined {
    const tag = event.tags.find((t) => t[0] === tagName);
    return tag ? tag[1] : undefined;
}

export function getTags(event: NDKEvent, tagName: string): string[] {
    return event.tags
        .filter((t) => t[0] === tagName && t[1] !== undefined)
        .map((t) => t[1]) as string[];
}

export function hasTag(event: NDKEvent, tagName: string, value?: string): boolean {
    if (value === undefined) {
        return event.tags.some((t) => t[0] === tagName);
    }
    return event.tags.some((t) => t[0] === tagName && t[1] === value);
}

export function addTag(event: NDKEvent, tag: string[]): void {
    event.tags.push(tag);
}

export function removeTag(event: NDKEvent, tagName: string, value?: string): void {
    event.tags = event.tags.filter((t) => {
        if (t[0] !== tagName) return true;
        if (value === undefined) return false;
        return t[1] !== value;
    });
}
