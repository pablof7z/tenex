import type { NDKKind } from "@nostr-dev-kit/ndk";
import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { useMemo } from "react";

export interface ProjectAgent {
    pubkey: string;
    name: string;
}

// Custom hook to track project agents from status events
export function useProjectAgents(projectTagId: string | undefined) {
    // Subscribe to kind 24010 events for this project
    const { events: statusEvents } = useSubscribe(
        projectTagId
            ? [
                  {
                      kinds: [24010 as NDKKind],
                      "#a": [projectTagId],
                  },
              ]
            : false,
        {},
        [projectTagId]
    );

    // Extract agents from the latest status event
    const agents = useMemo(() => {
        if (!statusEvents || statusEvents.length === 0) return [];

        // Sort events by created_at to get the most recent
        const sortedEvents = [...statusEvents].sort(
            (a, b) => (b.created_at || 0) - (a.created_at || 0)
        );

        // Get the most recent event
        const latestEvent = sortedEvents[0];
        if (!latestEvent) return [];

        // Extract agents from p-tags
        const agentList: ProjectAgent[] = [];
        latestEvent.tags.forEach((tag) => {
            if (tag[0] === "p" && tag.length >= 3 && tag[1] && tag[2]) {
                agentList.push({
                    pubkey: tag[1],
                    name: tag[2],
                });
            }
        });

        return agentList;
    }, [statusEvents]);

    return agents;
}
