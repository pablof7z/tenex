import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import type { NDKKind } from "@nostr-dev-kit/ndk-hooks";
import { EVENT_KINDS } from "../lib/constants.js";
import { useMemo } from "react";

interface StreamingResponse {
    agentPubkey: string;
    content: string;
    sequence: number;
}

/**
 * Hook to subscribe to streaming response events (kind 21111)
 * for a specific conversation/thread
 */
export function useStreamingResponses(conversationId: string | null) {
    // Debug logging
    console.log("[useStreamingResponses] Hook called with conversationId:", conversationId);
    
    // Subscribe to streaming responses for this conversation
    const { events: streamingEvents } = useSubscribe(
        conversationId
            ? [
                  {
                      kinds: [EVENT_KINDS.STREAMING_RESPONSE as NDKKind],
                      "#e": [conversationId],
                  },
              ]
            : false,
        {},
        [conversationId]
    );
    
    // Debug logging
    if (streamingEvents && streamingEvents.length > 0) {
        console.log("[useStreamingResponses] Found streaming events:", {
            conversationId,
            eventCount: streamingEvents.length,
            events: streamingEvents.map(e => ({
                id: e.id,
                pubkey: e.pubkey,
                eTags: e.tags.filter(t => t[0] === "e").map(t => t[1]),
                sequence: e.tagValue("sequence"),
                contentLength: e.content.length,
            })),
        });
    }

    // Process streaming events to get the latest content per agent
    const streamingResponses = useMemo(() => {
        if (!streamingEvents || streamingEvents.length === 0) return new Map<string, StreamingResponse>();

        const responsesByAgent = new Map<string, StreamingResponse>();

        // Group events by agent pubkey and find the latest (highest sequence) for each
        for (const event of streamingEvents) {
            const agentPubkey = event.tagValue("p");
            if (!agentPubkey) {
                console.log("[useStreamingResponses] Event missing p tag:", {
                    eventId: event.id,
                    tags: event.tags,
                });
                continue;
            }

            const sequenceStr = event.tagValue("sequence");
            const sequence = sequenceStr ? parseInt(sequenceStr, 10) : 0;

            const existing = responsesByAgent.get(agentPubkey);
            if (!existing || sequence > existing.sequence) {
                responsesByAgent.set(agentPubkey, {
                    agentPubkey,
                    content: event.content,
                    sequence,
                });
            }
        }
        
        console.log("[useStreamingResponses] Processed responses by agent:", {
            agentCount: responsesByAgent.size,
            agents: Array.from(responsesByAgent.entries()).map(([pubkey, resp]) => ({
                pubkey,
                sequence: resp.sequence,
                contentLength: resp.content.length,
                contentPreview: resp.content.substring(0, 50) + "...",
            })),
        });

        return responsesByAgent;
    }, [streamingEvents]);

    return {
        streamingResponses,
        hasStreamingResponses: streamingResponses.size > 0,
    };
}