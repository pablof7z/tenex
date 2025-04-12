"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Skeleton import removed
import { NDKEvent } from "@nostr-dev-kit/ndk"; // Import NDKEvent
import { NDKTask } from "@/lib/nostr/events/task"; // Assuming this path is correct
import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";

interface DescriptionBoxProps {
    task: NDKTask | null;
    // loadingTask prop removed
    taskDescription: string;
    // onPublishReply prop removed, logic moved inside
}

export function DescriptionBox({
    task,
    // loadingTask prop removed
    taskDescription,
    // onPublishReply prop removed
}: DescriptionBoxProps) {
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [replyContent, setReplyContent] = useState("");
    const [isPublishingReply, setIsPublishingReply] = useState(false);
    const { toast } = useToast();
    const { events: replies } = useSubscribe(task ? [
        { kinds: [1111], "#E": [task.id] }
    ] : false);

    const handlePublishClick = async () => {
        if (!task || !replyContent.trim()) {
             toast({
                 title: "Error",
                 description: "Task data not loaded or comment is empty.",
                 variant: "destructive",
             });
            return;
        }

        setIsPublishingReply(true);
        try {
            // Manually create the reply event
            const replyEvent = task.reply();
            replyEvent.content = replyContent;

            await replyEvent.publish();

            toast({
                title: "Success",
                description: "Comment published successfully.",
            });
            setReplyContent("");
            setShowReplyInput(false);
        } catch (error) {
             console.error("Failed to publish reply:", error);
             toast({
                 title: "Error Publishing Reply",
                 description: "Could not publish comment.",
                 variant: "destructive",
             });
        } finally {
            setIsPublishingReply(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
                <p>{taskDescription || "No description provided."}</p>
            
                {replies.map((reply: NDKEvent) => ( // Add type annotation
                    <div key={reply.id} className="mt-4 pt-4 border-t">
                        <p className="text-sm">{reply.content}</p>
                    </div>
                ))}
            </CardContent>

            <div className="p-4 border-t">
                {!showReplyInput ? (
                    <Button variant="outline" onClick={() => setShowReplyInput(true)}>
                        Add Comment
                    </Button>
                ) : (
                    <div className="space-y-2">
                        <Textarea
                            placeholder="Write your comment..."
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            disabled={isPublishingReply}
                        />
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setShowReplyInput(false)} disabled={isPublishingReply}>
                                Cancel
                            </Button>
                            <Button onClick={handlePublishClick} disabled={isPublishingReply || !replyContent.trim()}>
                                {isPublishingReply ? "Publishing..." : "Publish Comment"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}