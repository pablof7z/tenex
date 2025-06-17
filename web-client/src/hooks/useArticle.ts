import { type NDKArticle, useNDK, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { EVENT_KINDS } from "@tenex/types/events";
import { nip19 } from "nostr-tools";
import { useMemo } from "react";

export function useArticle(articleIdOrNaddr?: string): NDKArticle | null {
    const { ndk } = useNDK();

    // Parse the article identifier
    const filter = useMemo(() => {
        if (!articleIdOrNaddr || !ndk) return false;

        // Check if it's a note/nevent (starts with 'note' or 'nevent')
        if (articleIdOrNaddr.startsWith("note") || articleIdOrNaddr.startsWith("nevent")) {
            try {
                const decoded = nip19.decode(articleIdOrNaddr);
                if (decoded.type === "note") {
                    // It's an event ID
                    return [{ ids: [decoded.data], kinds: [EVENT_KINDS.ARTICLE] }];
                }
                if (decoded.type === "nevent") {
                    // It's an nevent
                    return [{ ids: [decoded.data.id], kinds: [EVENT_KINDS.ARTICLE] }];
                }
            } catch (_e) {
                // console.error("Failed to decode article ID:", e);
                return false;
            }
        }

        // Check if it's an naddr
        if (articleIdOrNaddr.startsWith("naddr")) {
            try {
                const decoded = nip19.decode(articleIdOrNaddr);
                if (decoded.type === "naddr") {
                    // It's an naddr
                    return [
                        {
                            kinds: [EVENT_KINDS.ARTICLE],
                            authors: [decoded.data.pubkey],
                            "#d": [decoded.data.identifier],
                        },
                    ];
                }
            } catch (_e) {
                // console.error("Failed to decode naddr:", e);
                return false;
            }
        }

        // Assume it's a raw event ID
        return [{ ids: [articleIdOrNaddr], kinds: [EVENT_KINDS.ARTICLE] }];
    }, [articleIdOrNaddr, ndk]);

    const { events } = useSubscribe<NDKArticle>(filter, { wrap: true }, [articleIdOrNaddr]);

    return events && events.length > 0 ? events[0] || null : null;
}
