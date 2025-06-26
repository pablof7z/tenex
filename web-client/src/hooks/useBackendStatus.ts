import { useNDKCurrentPubkey, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { useAtom } from "jotai";
import { useEffect } from "react";
import { type BackendInfo, onlineBackendsAtom } from "../lib/store";
import { parseBackendStatusEvent, migrateBackendStatus, createBackendInfo } from "../lib/types.js";

// Custom hook to track online backend status
export function useBackendStatus() {
    const currentPubkey = useNDKCurrentPubkey();
    const [onlineBackends, setOnlineBackends] = useAtom(onlineBackendsAtom);

    // Subscribe to kind 24010 events (project status pings)
    // TODO: This needs to be updated to track project-specific status events
    // For now, return empty to avoid subscribing to non-existent 24009 events
    const { events: statusEvents } = useSubscribe(
        false, // Disabled for now
        {},
        [currentPubkey]
    );

    // Update the online backends map when new status events come in
    useEffect(() => {
        if (!statusEvents || statusEvents.length === 0) return;

        const newOnlineBackends = new Map<string, BackendInfo>();

        // Process status events to determine which backends are online
        for (const event of statusEvents) {
            const backendPubkey = event.pubkey;
            let backendInfo: BackendInfo | null = null;

            try {
                // Try to parse JSON content from new format with validation
                const parsed = parseBackendStatusEvent(event.content);
                if (parsed) {
                    backendInfo = createBackendInfo(backendPubkey, {
                        name: `Backend ${backendPubkey.slice(0, 8)}`,
                        hostname: parsed.hostname,
                        lastSeen: event.created_at || Date.now() / 1000,
                        projects: parsed.projects,
                    });
                } else {
                    // Fallback for invalid format
                    const rawParsed = JSON.parse(event.content);
                    const migrated = migrateBackendStatus(rawParsed);
                    if (migrated) {
                        backendInfo = createBackendInfo(backendPubkey, {
                            name: `Backend ${backendPubkey.slice(0, 8)}`,
                            hostname: migrated.hostname,
                            lastSeen: event.created_at || Date.now() / 1000,
                            projects: migrated.projects,
                        });
                    }
                }
            } catch {
                // Fallback for old format (plain text hostname)
                backendInfo = createBackendInfo(backendPubkey, {
                    name: event.content || `Backend ${backendPubkey.slice(0, 8)}`,
                    hostname: event.content || "Unknown",
                    lastSeen: event.created_at || Date.now() / 1000,
                    projects: [],
                });
            }

            // Only add valid backend info
            if (backendInfo) {
                newOnlineBackends.set(backendPubkey, backendInfo);
            }
        }

        setOnlineBackends(newOnlineBackends);
    }, [statusEvents, setOnlineBackends]);

    return { onlineBackends };
}
