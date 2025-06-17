import { type NDKArticle, useEvent } from "@nostr-dev-kit/ndk-hooks";

export function useArticle(articleIdOrNaddr?: string): NDKArticle | null {
    return useEvent<NDKArticle>(articleIdOrNaddr || false, { wrap: true }) as NDKArticle | null;
}
