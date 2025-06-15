import type { NDKEvent, NDKKind } from "@nostr-dev-kit/ndk";
import { useNDK, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { atom, useAtom } from "jotai";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

// Atom to store the latest lesson event for display
export const latestLessonAtom = atom<NDKEvent | null>(null);

/**
 * Hook to monitor for new agent lessons and show notifications
 */
export function useAgentLessons() {
    const { ndk } = useNDK();
    const [, setLatestLesson] = useAtom(latestLessonAtom);
    const seenLessons = useRef(new Set<string>());

    // Subscribe to all agent lesson events
    const { events: lessons, eose } = useSubscribe(
        [{ kinds: [4124 as NDKKind], limit: 50 }],
        {},
        []
    );

    // Track EOSE to know when initial load is complete
    const initialLoadComplete = useRef(false);
    useEffect(() => {
        if (eose && !initialLoadComplete.current) {
            initialLoadComplete.current = true;
            // Mark all initial lessons as seen
            if (lessons) {
                for (const lesson of lessons) {
                    seenLessons.current.add(lesson.id);
                }
            }
        }
    }, [eose, lessons]);

    // Handle new lessons
    useEffect(() => {
        if (!lessons || !initialLoadComplete.current) return;

        for (const lesson of lessons) {
            if (!seenLessons.current.has(lesson.id)) {
                seenLessons.current.add(lesson.id);

                // This is a new lesson after initial load
                const title = lesson.tagValue("title") || "New Lesson";
                const agentEventId = lesson.tags.find((tag) => tag[0] === "e")?.[1];

                // Find the agent name by fetching the agent event
                if (agentEventId && ndk) {
                    ndk.fetchEvent(agentEventId).then((agentEvent) => {
                        const agentName =
                            agentEvent?.tagValue("title") ||
                            agentEvent?.tagValue("name") ||
                            "Unknown Agent";

                        // Show toast notification
                        toast.success("Agent learned something!", {
                            description: `${agentName}: ${title}`,
                            duration: 5000,
                        });
                    });
                } else {
                    // Show toast without agent name
                    toast.success("Agent learned something!", {
                        description: title,
                        duration: 5000,
                    });
                }

                // Update the latest lesson atom
                setLatestLesson(lesson);
            }
        }
    }, [lessons, ndk, setLatestLesson]);

    return {
        lessons: lessons || [],
        latestLesson: lessons?.[0] || null,
    };
}

/**
 * Hook to get lessons for a specific agent
 */
export function useAgentLessonsByEventId(agentEventId: string | undefined) {
    const { events: lessons } = useSubscribe(
        agentEventId ? [{ kinds: [4124 as NDKKind], "#e": [agentEventId] }] : false,
        {},
        [agentEventId]
    );

    return lessons || [];
}
