"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { NDKEvent, NDKKind, NDKTag, NDKFilter } from "@nostr-dev-kit/ndk";
import { NDKTask } from "@/lib/nostr/events/task"; // Assuming this path is correct
import ndk from "@/lib/nostr/ndk";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { NoteCard } from "@/components/events/note/card";
import { AppLayout } from "@/components/app-layout";

export default function TaskDetailPage() {
    const params = useParams();
    const projectId = params.id as string; // Assuming project context might be needed later
    const taskId = params.taskId as string;

    const [task, setTask] = useState<NDKTask | null>(null);
    const [referencedEvents, setReferencedEvents] = useState<NDKEvent[]>([]);
    const [loadingTask, setLoadingTask] = useState(true);
    const [loadingRefs, setLoadingRefs] = useState(true);

    useEffect(() => {
        if (!ndk || !taskId) return;

        const fetchTask = async () => {
            setLoadingTask(true);
            const taskEvent = await ndk.fetchEvent({ ids: [taskId] });
            if (taskEvent) {
                const ndkTask = NDKTask.from(taskEvent);
                setTask(ndkTask);

                // Fetch referenced events
                const eTags = ndkTask.tags.filter((tag: NDKTag) => tag[0] === "e");
                const refIds = eTags.map((tag: NDKTag) => tag[1]).filter(Boolean); // Get the event IDs from 'e' tags

                if (refIds.length > 0) {
                    setLoadingRefs(true);
                    const filter: NDKFilter = { ids: refIds };
                    const events = await ndk.fetchEvents(filter);
                    // Convert Set<NDKEvent> to Array<NDKEvent>
                    setReferencedEvents(Array.from(events));
                    setLoadingRefs(false);
                } else {
                    setLoadingRefs(false);
                }
            }
            setLoadingTask(false);
        };

        fetchTask();
    }, [taskId]);

    const taskTitle = task?.tags.find((tag) => tag[0] === "title")?.[1] ?? "Loading Task...";
    const taskDescription = task?.content ?? "";

    return (
        <AppLayout>
            <div className="flex flex-col h-screen p-4 md:p-6 lg:p-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-bold">
                        {loadingTask ? <Skeleton className="h-8 w-64" /> : taskTitle}
                    </h1>
                    <Button>Start Agent Work</Button>
                </div>

                {/* Main Content Area */}
                <div className="flex flex-1 gap-6 overflow-hidden">
                    {/* Left Column (Agent Updates - Placeholder) */}
                    <div className="w-1/4 border rounded-lg p-4 overflow-y-auto">
                        <h2 className="text-lg font-semibold mb-4">Agent Updates</h2>
                        {/* Placeholder for agent updates */}
                        <p className="text-muted-foreground">Agent updates will appear here.</p>
                    </div>

                    {/* Right Column (Task Details, References, Comments) */}
                    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                        {/* Task Description */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Description</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loadingTask ? (
                                    <Skeleton className="h-20 w-full" />
                                ) : (
                                    <p>{taskDescription || "No description provided."}</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Tabs for References and Comments */}
                        <Tabs defaultValue="references" className="flex-1 flex flex-col overflow-hidden">
                            <TabsList>
                                <TabsTrigger value="references">References</TabsTrigger>
                                <TabsTrigger value="comments">Comments</TabsTrigger>
                            </TabsList>
                            <TabsContent value="references" className="flex-1 overflow-y-auto p-1">
                                {loadingRefs ? (
                                    <div className="space-y-4">
                                        <Skeleton className="h-24 w-full" />
                                        <Skeleton className="h-24 w-full" />
                                        <Skeleton className="h-24 w-full" />
                                    </div>
                                ) : referencedEvents.length > 0 ? (
                                    <div className="space-y-4">
                                        {referencedEvents.map((event) => (
                                            <NoteCard
                                                key={event.id}
                                                event={event}
                                                // Provide dummy props as interactions are not needed here
                                                // Removed internal handling props: isReplying, replyContent, onReplyContentChange, onShowReply, onCancelReply, onSendReply, onZap
                                                // Keep external interaction props if needed, or provide dummies if not applicable in this context
                                                onRepost={() => { console.log("Repost clicked in task detail"); }} // Example dummy handler
                                                onQuote={() => { console.log("Quote clicked in task detail"); }}   // Example dummy handler
                                                // onCreateIssue is optional and not needed here
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-center p-4">No references found.</p>
                                )}
                            </TabsContent>
                            <TabsContent value="comments" className="flex-1 overflow-y-auto p-4">
                                <h3 className="text-lg font-semibold mb-4">Comments</h3>
                                {/* Placeholder for comments section */}
                                <p className="text-muted-foreground">Comments feature coming soon.</p>
                                {/* TODO: Add comment input and display */}
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
