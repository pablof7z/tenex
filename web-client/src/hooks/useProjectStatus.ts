import type { NDKKind } from "@nostr-dev-kit/ndk";
import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { useSetAtom } from "jotai";
import { useEffect } from "react";
import { onlineProjectStatusAtom } from "../lib/store";

// Custom hook to track online project status from kind 24010 events
export function useProjectStatus() {
    const setOnlineProjectStatus = useSetAtom(onlineProjectStatusAtom);

    // Set up periodic cleanup of stale entries
    useEffect(() => {
        const cleanupInterval = setInterval(() => {
            setOnlineProjectStatus((prevStatus) => {
                const newStatus = new Map(prevStatus);
                const now = Date.now() / 1000;

                // Remove entries older than 90 seconds
                for (const [projectDir, timestamp] of newStatus.entries()) {
                    if (now - timestamp > 90) {
                        newStatus.delete(projectDir);
                    }
                }

                return newStatus;
            });
        }, 30000); // Run cleanup every 30 seconds

        return () => clearInterval(cleanupInterval);
    }, [setOnlineProjectStatus]);

    // Subscribe to kind 24010 events (project status pings)
    const { events: statusEvents } = useSubscribe(
        [
            {
                kinds: [24010 as NDKKind],
                since: Math.floor(Date.now() / 1000) - 300, // Last 5 minutes
            },
        ],
        {},
        []
    );

    // Update the online projects map when new status events come in
    useEffect(() => {
        if (!statusEvents || statusEvents.length === 0) return;

        setOnlineProjectStatus((prevStatus) => {
            const newStatus = new Map(prevStatus);

            // Process status events to determine which projects are online
            statusEvents.forEach((event) => {
                // Find the "a" tag to get project info
                const aTag = event.tags?.find((tag) => tag[0] === "a");
                if (aTag?.[1]) {
                    // Extract project directory from the tag
                    // Format: 31933:pubkey:directory
                    const parts = aTag[1].split(":");
                    if (parts.length >= 3) {
                        const projectDir = parts[2];
                        // Update timestamp for this project
                        newStatus.set(projectDir || "", event.created_at || Date.now() / 1000);
                    }
                }
            });

            // Clean up old entries (older than 90 seconds)
            const now = Date.now() / 1000;
            for (const [projectDir, timestamp] of newStatus.entries()) {
                if (now - timestamp > 90) {
                    newStatus.delete(projectDir);
                }
            }

            return newStatus;
        });
    }, [statusEvents, setOnlineProjectStatus]);
}
