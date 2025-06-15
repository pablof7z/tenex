import { type NDKArticle, useNDK, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
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
                    return [{ ids: [decoded.data], kinds: [30023] }];
                }
                if (decoded.type === "nevent") {
                    // It's an nevent
                    return [{ ids: [decoded.data.id], kinds: [30023] }];
                }
            } catch (e) {
                console.error("Failed to decode article ID:", e);
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
                            kinds: [30023],
                            authors: [decoded.data.pubkey],
                            "#d": [decoded.data.identifier],
                        },
                    ];
                }
            } catch (e) {
                console.error("Failed to decode naddr:", e);
                return false;
            }
        }

        // Assume it's a raw event ID
        return [{ ids: [articleIdOrNaddr], kinds: [30023] }];
    }, [articleIdOrNaddr, ndk]);

    const { events } = useSubscribe<NDKArticle>(filter, { wrap: true }, [articleIdOrNaddr]);

    return events && events.length > 0 ? events[0] || null : null;
}
