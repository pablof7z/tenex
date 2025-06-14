import { useNDKCurrentPubkey, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { useAtom } from "jotai";
import { useEffect } from "react";
import { type BackendInfo, onlineBackendsAtom } from "../lib/store";

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
        statusEvents.forEach((event) => {
            const backendPubkey = event.pubkey;
            let backendInfo: BackendInfo;

            try {
                // Try to parse JSON content from new format
                const parsed = JSON.parse(event.content);
                backendInfo = {
                    name: `Backend ${backendPubkey.slice(0, 8)}`,
                    hostname: parsed.hostname || "Unknown",
                    lastSeen: event.created_at || Date.now() / 1000,
                    projects: parsed.projects || [],
                };
            } catch {
                // Fallback for old format (plain text hostname)
                backendInfo = {
                    name: event.content || `Backend ${backendPubkey.slice(0, 8)}`,
                    hostname: event.content || "Unknown",
                    lastSeen: event.created_at || Date.now() / 1000,
                    projects: [],
                };
            }

            newOnlineBackends.set(backendPubkey, backendInfo);
        });

        setOnlineBackends(newOnlineBackends);
    }, [statusEvents, setOnlineBackends]);

    return { onlineBackends };
}
