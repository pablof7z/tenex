"use client";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NDKTask } from "@/lib/nostr/events/task";
import { NDKEvent, NDKKind } from "@nostr-dev-kit/ndk";
import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import React, { useEffect, useState } from "react";

interface TaskReactButtonProps {
    taskEvent: NDKTask;
}

export function TaskReactButton({ taskEvent }: TaskReactButtonProps) {
    const [currentReaction, setCurrentReaction] = useState<string | null>(null);

    // Subscribe to reaction events for this task
    const { events: reactionEvents } = useSubscribe([{ kinds: [7], "#e": [taskEvent.id] }]);

    // Update the current reaction when reaction events change
    useEffect(() => {
        if (reactionEvents.length > 0) {
            // Sort by created_at to get the most recent reaction
            const sortedEvents = [...reactionEvents].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

            // Get the content of the most recent reaction
            const latestReaction = sortedEvents[0].content;
            setCurrentReaction(latestReaction);
        }
    }, [reactionEvents]);

    // Function to create a reaction event
    const handleReaction = async (emoji: string) => {
        try {
            // Create a new reaction event
            const reactionEvent = new NDKEvent(taskEvent.ndk);
            reactionEvent.kind = 7; // Reaction event kind
            reactionEvent.content = emoji;
            reactionEvent.tags = [
                ["e", taskEvent.id], // Reference to the task event
                ["p", taskEvent.pubkey], // Reference to the task author
            ];

            // Sign and publish the event
            await reactionEvent.publish();

            // Update the current reaction
            setCurrentReaction(emoji);
        } catch (error) {
            console.error("Failed to create reaction:", error);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-md">
                    {currentReaction || "React"}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleReaction("✅")}>✅ Mark Complete</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
