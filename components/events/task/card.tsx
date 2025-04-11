"use client";

import React from "react";
import { NDKTask } from "@/lib/nostr/events/task";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { nip19 } from "nostr-tools";

interface TaskCardProps {
    task: NDKTask;
    onTaskSelect: (task: NDKTask) => void;
    onDeleteTask?: (taskId: string) => void;
}

export function TaskCard({ task, onTaskSelect, onDeleteTask }: TaskCardProps) {
    // TODO: Fetch profile metadata for creatorName
    // TODO: Fetch related events for references/comments count
    const creatorName =
        task.author.profile?.displayName ||
        task.author.profile?.name ||
        nip19.npubEncode(task.author.pubkey).substring(0, 12) + "...";
    const createdAt = task.created_at ? new Date(task.created_at * 1000).toLocaleString() : "Unknown date";
    const references = 0; // Placeholder
    const comments = []; // Placeholder

    return (
        <div
            key={task.id} // Key is still useful here for list rendering if needed, though parent map provides it too
            className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 last:border-0 gap-3"
        >
            <div className="flex items-start gap-3">
                <div>
                    <p className="font-medium text-lg">{task.title || "Untitled Task"}</p>
                    <p className="text-sm text-muted-foreground mt-1">{task.content}</p> {/* Display content */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center">
                            <span className="font-medium">@{creatorName}</span>
                        </span>
                        <span>•</span>
                        <span>{createdAt}</span>
                        {references > 0 && (
                            <>
                                <span>•</span>
                                <span className="flex items-center">
                                    <MessageSquare className="h-3 w-3 mr-1" />
                                    {references} references
                                </span>
                            </>
                        )}
                        {comments.length > 0 && (
                            <>
                                <span>•</span>
                                <span className="flex items-center">
                                    <MessageSquare className="h-3 w-3 mr-1" />
                                    {comments.length} comments
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2 ml-7 sm:ml-0">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onTaskSelect(task)} // Pass NDKTask
                    className="rounded-md"
                >
                    View
                </Button>
                {onDeleteTask && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive rounded-md"
                        onClick={() => onDeleteTask(task.id)} // Use task.id
                    >
                        Delete
                    </Button>
                )}
            </div>
        </div>
    );
}
