"use client";

import { useEffect, useMemo, useState } from "react";
// Textarea import removed as it's now in DescriptionBox
import { useToast } from "@/components/ui/use-toast"; // Import useToast
import { useParams } from "next/navigation";
import { NDKEvent, NDKKind, NDKTag, NDKFilter } from "@nostr-dev-kit/ndk";
import { NDKTask } from "@/lib/nostr/events/task"; // Assuming this path is correct
import ndk from "@/lib/nostr/ndk";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NoteCard } from "@/components/events/note/card";
import { AppLayout } from "@/components/app-layout";
import { DescriptionBox } from "@/components/events/task/description-box";
import { TaskUpdates } from "@/components/events/task/TaskUpdates"; // Import TaskUpdates
import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { ConfirmWorkModal } from "@/components/modals/ConfirmWorkModal"; // Import the modal

export default function TaskDetailPage() {
    const params = useParams();
    const projectId = params.slug as string; // Assuming project context might be needed later
    const taskId = params.taskId as string;
    const [task, setTask] = useState<NDKTask | null>(null);
    const [referencedEvents, setReferencedEvents] = useState<NDKEvent[]>([]);
    const [isStartingWork, setIsStartingWork] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false); // State for modal visibility
    const [combinedContent, setCombinedContent] = useState(""); // State for combined content
    const { events: replies } = useSubscribe(task ? [{ kinds: [1111], "#E": [task.id] }] : false);

    const sortedReplies = useMemo(() => {
        if (!replies) return [];
        return replies.sort((a, b) => {
            const aCreatedAt = a.created_at || 0;
            const bCreatedAt = b.created_at || 0;
            return aCreatedAt - bCreatedAt;
        });
    }, [replies]);

    // Reply state (showReplyInput, replyContent, isPublishingReply) moved to DescriptionBox
    // isPublishingReply state removed, now handled by DescriptionBox
    const { toast } = useToast(); // Initialize toast

    useEffect(() => {
        if (!ndk || !taskId) return;

        const fetchTask = async () => {
            // setLoadingTask removed
            const taskEvent = await ndk.fetchEvent({ ids: [taskId] });
            if (taskEvent) {
                const ndkTask = NDKTask.from(taskEvent);
                setTask(ndkTask);

                // Fetch referenced events
                const eTags = ndkTask.tags.filter((tag: NDKTag) => tag[0] === "e");
                const refIds = eTags.map((tag: NDKTag) => tag[1]).filter(Boolean); // Get the event IDs from 'e' tags

                if (refIds.length > 0) {
                    const filter: NDKFilter = { ids: refIds };
                    const events = await ndk.fetchEvents(filter);
                    setReferencedEvents(Array.from(events));
                } else {
                }
            }
            // setLoadingTask removed
        };

        fetchTask();
    }, [taskId]);

    const taskTitle = task?.tags.find((tag) => tag[0] === "title")?.[1] ?? "Task"; // Default title if task is null initially
    const taskDescription = task?.content ?? "";

    // Function to handle the actual API submission
    const submitWork = async (descriptionToSubmit: string) => {
        if (!projectId || !taskId || !task) return; // Guard clause already checked before calling

        setIsStartingWork(true);
        try {
            const apiUrl = `/api/projects/${projectId}/tasks/${taskId}/work`;
            const context = referencedEvents.map((event) => event.content).join("\n---\n");

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: taskTitle,
                    description: descriptionToSubmit, // Use the provided description
                    context: context,
                }),
            });

            const result = await response.json();

            if (response.ok && response.status === 202) {
                toast({
                    title: "Success",
                    description: `Agent work initiated for task ${taskId}. ${result.message || ""}`,
                });
                setIsModalOpen(false); // Close modal on success
                // Optionally, navigate away or update UI
            } else {
                throw new Error(result.error || `Failed to start agent work (status ${response.status})`);
            }
        } catch (error: unknown) {
            console.error("Failed to start agent work:", error);
            let errorMessage = "An unexpected error occurred.";
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            toast({
                title: "Error Starting Work",
                description: errorMessage,
                variant: "destructive",
            });
            // Keep modal open on error for user to retry or cancel
        } finally {
            setIsStartingWork(false);
        }
    };

    // Renamed original handler, now decides whether to show modal or submit directly
    const handleInitiateWork = async () => {
        if (!projectId || !taskId || !task) {
            toast({
                title: "Error",
                description: "Task data not loaded yet.",
                variant: "destructive",
            });
            return;
        }

        if (sortedReplies && sortedReplies.length > 0) {
            // Replies exist, show modal
            const replyContents = sortedReplies.map((reply) => reply.content);
            const initialModalContent = [taskDescription, ...replyContents].join("\n\n");
            setCombinedContent(initialModalContent);
            setIsModalOpen(true);
        } else {
            // No replies, submit directly
            await submitWork(taskDescription);
        }
    };

    // Handler for modal submission
    const handleModalSubmit = async (editedContent: string) => {
        await submitWork(editedContent);
    };

    // publishReplyHandler removed, logic is now fully inside DescriptionBox

    // handleQuotePlaceholder removed as NoteCard now handles quoting internally
    return (
        <AppLayout>
            <div className="flex flex-col h-screen p-4 md:p-6 lg:p-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-bold">{taskTitle}</h1>
                    <Button onClick={handleInitiateWork} disabled={!task || isStartingWork}>
                        {" "}
                        {/* Use new handler */}
                        {isStartingWork ? "Starting..." : "Start Agent Work"}
                    </Button>
                </div>

                {/* Main Content Area */}
                <div className="flex flex-1 gap-6 overflow-hidden">
                    {/* Left Column (Agent Updates) */}
                    <div className="w-1/3 border rounded-lg p-4 overflow-hidden">
                        {" "}
                        {/* Changed overflow-y-auto to overflow-hidden */}
                        <TaskUpdates taskId={taskId} projectSlug={projectId} />
                    </div>

                    {/* Right Column (Task Details, References, Comments) */}
                    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                        {/* Task Description */}
                        <DescriptionBox
                            task={task}
                            // loadingTask prop removed
                            taskDescription={taskDescription}
                            // onPublishReply prop removed
                        />

                        {/* Tabs for References and Comments */}
                        <Tabs defaultValue="references" className="flex-1 flex flex-col overflow-hidden">
                            <TabsList>
                                <TabsTrigger value="references">References</TabsTrigger>
                            </TabsList>
                            <TabsContent value="references" className="flex-1 overflow-y-auto p-1">
                                {referencedEvents.length > 0 ? (
                                    <div className="space-y-4">
                                        {referencedEvents.map((event) => (
                                            <NoteCard
                                                key={event.id}
                                                event={event}
                                                // onQuote={handleQuotePlaceholder} // Removed, NoteCard handles quoting internally
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-center p-4">No references found.</p>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div>
            {/* Render the modal */}
            {isModalOpen && (
                <ConfirmWorkModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    initialContent={combinedContent}
                    onSubmit={handleModalSubmit}
                    isSubmitting={isStartingWork}
                />
            )}
        </AppLayout>
    );
}
