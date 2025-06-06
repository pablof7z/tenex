import { NDKEvent } from "@nostr-dev-kit/ndk";
import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { Loader2 } from "lucide-react";
import React, { useMemo } from "react";
import { NoteCard } from "@/components/events/note/card";
import { useProjectStore } from "@/lib/store/projects";

interface TaskUpdatesProps {
    taskId: string;
    projectSlug: string;
}

export function TaskUpdates({ taskId, projectSlug }: TaskUpdatesProps) {
    const getPubkeyBySlug = useProjectStore((state) => state.getPubkeyBySlug);
    const agentPubkey = getPubkeyBySlug(projectSlug);

    const { events } = useSubscribe(taskId ? [{ kinds: [1], "#e": [taskId] }] : false, {}, [taskId, agentPubkey]);

    const sortedEvents = useMemo(() => {
        if (!events) return [];
        // Sort descending by created_at (newest first)
        return [...events].sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
    }, [events]);

    return (
        <div className="flex flex-col h-full">
            <h2 className="text-lg font-semibold mb-4 sticky top-0 bg-background z-10 pb-2 border-b">Agent Updates</h2>
            {sortedEvents.length > 0 ? (
                <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                    {" "}
                    {/* Added pr-2 for scrollbar */}
                    {sortedEvents.map((event: NDKEvent) => (
                        <NoteCard key={event.id} event={event} skipTaggedTask={true} />
                    ))}
                </div>
            ) : (
                <p className="text-muted-foreground text-center flex-1 mt-4">
                    No agent updates found for this task yet.
                </p>
            )}
        </div>
    );
}
