import React, { useMemo } from 'react';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { useSubscribe } from '@nostr-dev-kit/ndk-hooks';
import { useProjectStore } from '@/lib/store/projects';
import { NoteCard } from '@/components/events/note/card';
import { Loader2 } from 'lucide-react';

interface TaskUpdatesProps {
    taskId: string;
    projectSlug: string;
}

export function TaskUpdates({ taskId, projectSlug }: TaskUpdatesProps) {
    const getPubkeyBySlug = useProjectStore((state) => state.getPubkeyBySlug);
    const agentPubkey = getPubkeyBySlug(projectSlug);

    const filter = useMemo(() => {
        if (!agentPubkey || !taskId) return false; // Don't subscribe if data is missing
        return {
            kinds: [1],
            '#e': [taskId],
            authors: [agentPubkey],
        };
    }, [agentPubkey, taskId]);

    const { events, eose } = useSubscribe(filter ? [filter] : false); // Wrap filter in array

    const sortedEvents = useMemo(() => {
        if (!events) return [];
        // Sort descending by created_at (newest first)
        return [...events].sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
    }, [events]);

    // Determine loading state: Still loading if subscription is active, EOSE hasn't happened, and no events yet.
    const isLoading = !!filter && !eose && events.length === 0;

    return (
        <div className="flex flex-col h-full">
            <h2 className="text-lg font-semibold mb-4 sticky top-0 bg-background z-10 pb-2 border-b">Agent Updates</h2>
            {isLoading ? (
                 <div className="flex items-center justify-center flex-1">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                 </div>
            ) : sortedEvents.length > 0 ? (
                <div className="flex-1 space-y-4 overflow-y-auto pr-2"> {/* Added pr-2 for scrollbar */}
                    {sortedEvents.map((event: NDKEvent) => (
                        <NoteCard key={event.id} event={event} />
                    ))}
                </div>
            ) : (
                <p className="text-muted-foreground text-center flex-1 mt-4">No agent updates found for this task yet.</p>
            )}
        </div>
    );
}