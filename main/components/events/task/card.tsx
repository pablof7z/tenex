"use client";

import { useProfile } from "@nostr-dev-kit/ndk-hooks";
import { MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { LoadedProject } from "@/hooks/useProjects";
import { NDKTask } from "@/lib/nostr/events/task";
import { TaskReactButton } from "./TaskReactButton";

interface TaskCardProps {
    task: NDKTask;
    project: LoadedProject;
}

export function TaskCard({ task, project }: TaskCardProps) {
    const router = useRouter();
    const createdAt = new Date(task.created_at * 1000).toLocaleString();
    const references = 0; // Placeholder
    const comments = []; // Placeholder

    const profile = useProfile(task.pubkey);

    const handleClick = () => {
        router.push(`/project/${project.slug}/${task.id}`);
    };

    const handleDelete = () => {
        task.delete();
    };

    return (
        <div
            key={task.id} // Key is still useful here for list rendering if needed, though parent map provides it too
            className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 last:border-0 gap-3"
        >
            <div className="flex items-start gap-3">
                <div>
                    <p className="font-medium text-lg">{task.title || "Untitled Task"}</p>
                    <div className="text-sm text-muted-foreground mt-1 prose dark:prose-invert max-w-none prose-sm">
                        <ReactMarkdown>
                            {task.content?.split("\n").slice(0, 2).join("\n") +
                                (task.content?.split("\n").length > 2 ? "..." : "")}
                        </ReactMarkdown>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center">
                            <span className="font-medium">@{profile?.name}</span>
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
                <Button variant="outline" size="sm" onClick={handleClick} className="rounded-md">
                    View
                </Button>
                <TaskReactButton taskEvent={task} />
                <Button variant="ghost" size="sm" className="text-destructive rounded-md" onClick={handleDelete}>
                    Delete
                </Button>
            </div>
        </div>
    );
}
