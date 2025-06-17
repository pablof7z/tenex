import type { NDKEvent, NDKKind, NDKList } from "@nostr-dev-kit/ndk";
import { useNDKCurrentPubkey, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { EVENT_KINDS } from "@tenex/types/events";
import { atom, useAtom } from "jotai";
import { useEffect, useMemo } from "react";

// Atoms for storing app-level subscription data
export const pendingAgentRequestsAtom = atom<number>(0);
export const agentRequestEventsAtom = atom<NDKEvent[]>([]);
export const approvedAgentsAtom = atom<Set<string>>(new Set<string>());

/**
 * Hook for managing app-level subscriptions that should always be active
 * This includes monitoring for agent requests, notifications, etc.
 */
export function useAppSubscriptions() {
    const currentPubkey = useNDKCurrentPubkey();
    const [, setPendingAgentRequests] = useAtom(pendingAgentRequestsAtom);
    const [, setAgentRequestEvents] = useAtom(agentRequestEventsAtom);
    const [, setApprovedAgents] = useAtom(approvedAgentsAtom);

    // Subscribe to agent requests (kind 3199) for the current user
    const { events: agentRequests } = useSubscribe(
        currentPubkey
            ? [
                  {
                      kinds: [EVENT_KINDS.AGENT_REQUEST as NDKKind],
                      "#p": [currentPubkey],
                  },
              ]
            : false,
        {},
        [currentPubkey]
    );

    // Subscribe to user's agent list (kind 13199) to know which agents are already approved
    const { events: agentLists } = useSubscribe<NDKList>(
        currentPubkey
            ? [
                  {
                      kinds: [EVENT_KINDS.AGENT_REQUEST_LIST as NDKKind],
                      authors: [currentPubkey],
                      limit: 1,
                  },
              ]
            : false,
        { wrap: true },
        [currentPubkey]
    );

    // Update approved agents when agent list changes
    useEffect(() => {
        if (agentLists && agentLists.length > 0) {
            const approvedSet = new Set<string>();
            const latestList = agentLists[0];
            if (!latestList) return;

            const pTags = latestList.tags.filter((tag) => tag[0] === "p" && tag[1]);
            for (const tag of pTags) {
                approvedSet.add(tag[1] as string);
            }

            setApprovedAgents(approvedSet);
        }
    }, [agentLists, setApprovedAgents]);

    // Calculate pending requests and update atoms
    useEffect(() => {
        if (agentRequests) {
            setAgentRequestEvents(agentRequests);

            // Get approved agents from the atom
            setApprovedAgents((currentApproved: Set<string>) => {
                // Count pending requests (not yet approved)
                const pendingCount = agentRequests.filter(
                    (event) => !currentApproved.has(event.pubkey)
                ).length;

                setPendingAgentRequests(pendingCount);
                return currentApproved;
            });
        }
    }, [agentRequests, setAgentRequestEvents, setPendingAgentRequests, setApprovedAgents]);

    // Return data that components might need directly
    return {
        pendingAgentRequestsCount: useMemo(() => {
            if (!agentRequests) return 0;
            const approved = new Set<string>();
            if (agentLists && agentLists.length > 0) {
                const latestList = agentLists[0];
                if (latestList) {
                    const pTags = latestList.tags.filter((tag) => tag[0] === "p" && tag[1]);
                    for (const tag of pTags) {
                        approved.add(tag[1] as string);
                    }
                }
            }
            return agentRequests.filter((event) => !approved.has(event.pubkey)).length;
        }, [agentRequests, agentLists]),
    };
}

// Hook to get pending agent requests count
export function usePendingAgentRequests() {
    const [pendingCount] = useAtom(pendingAgentRequestsAtom);
    return pendingCount;
}

// Hook to get agent request events
export function useAgentRequestEvents() {
    const [events] = useAtom(agentRequestEventsAtom);
    const [approvedAgents] = useAtom(approvedAgentsAtom);

    return useMemo(() => {
        return events.filter((event) => !approvedAgents.has(event.pubkey));
    }, [events, approvedAgents]);
}
