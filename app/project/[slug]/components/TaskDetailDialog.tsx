import { useState } from "react";
import { Code, MessageSquare, Send } from "lucide-react"; // Added MessageSquare
import { nip19 } from "nostr-tools";
import { NDKEvent } from "@nostr-dev-kit/ndk"; // Added NDKEvent
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
// import { Task } from "./types"; // Removed local Task type
import { NDKTask } from "@/lib/nostr/events/task"; // Import NDKTask

interface TaskDetailDialogProps {
    task: NDKTask | null; // Expect NDKTask
    onClose: () => void;
    onAddComment?: (taskId: string, comment: string) => void;
    onLaunchEditor?: (taskId: string) => void;
}

export function TaskDetailDialog({ task, onClose, onAddComment, onLaunchEditor }: TaskDetailDialogProps) {
    const [commentText, setCommentText] = useState("");

    if (!task) return null;

    // TODO: Fetch profile metadata for creatorName
    // TODO: Fetch related events for references/comments count
    const creatorName =
        task.author.profile?.displayName ||
        task.author.profile?.name ||
        nip19.npubEncode(task.author.pubkey).substring(0, 12) + "...";
    const createdAt = task.created_at ? new Date(task.created_at * 1000).toLocaleString() : "Unknown date";
    const references = 0; // Placeholder
    const comments: NDKEvent[] = []; // Use NDKEvent[] for placeholder

    const handleAddComment = () => {
        if (commentText.trim() && onAddComment) {
            onAddComment(task.id, commentText); // Use task.id
            setCommentText("");
        }
    };

    return (
        <Dialog open={!!task} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] rounded-md">
                <DialogHeader>
                    <DialogTitle className="text-xl">{task.title || "Untitled Task"}</DialogTitle>
                    <DialogDescription>
                        Created by <span className="font-medium">@{creatorName}</span> • {createdAt}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    {" "}
                    {/* Increased spacing */}
                    {/* Task Content/Description */}
                    <div>
                        <h4 className="text-sm font-medium mb-2">Description</h4>
                        <p className="text-sm border rounded-md p-3 bg-secondary/50 border-border">
                            {task.content || "No description provided."}
                        </p>
                    </div>
                    {references > 0 && (
                        <div>
                            <h4 className="text-sm font-medium mb-2">Referenced Items ({references})</h4>
                            <div className="space-y-3 border rounded-md p-4 bg-secondary/50 border-border">
                                {/* Placeholder for actual referenced items */}
                                <p className="text-sm text-muted-foreground">
                                    Referenced item fetching not implemented yet.
                                </p>
                            </div>
                        </div>
                    )}
                    {/* Comments section */}
                    <div>
                        <h4 className="text-sm font-medium mb-2">Comments ({comments.length})</h4>
                        <div className="space-y-3 border rounded-md p-4 bg-secondary/50 border-border mb-4">
                            {comments.length > 0 ? (
                                comments.map(
                                    (
                                        comment: NDKEvent, // Use NDKEvent for placeholder type
                                    ) => (
                                        <div key={comment.id} className="border-b border-border pb-3 last:border-0">
                                            <p className="text-sm">{comment.content}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {/* Placeholder for comment author/time */}
                                                <span className="font-medium">@comment_author</span> • comment_timestamp
                                            </p>
                                        </div>
                                    ),
                                )
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No comments yet (fetching not implemented).
                                </p>
                            )}
                        </div>

                        {/* Add comment form */}
                        {/* Add comment form */}
                        <div className="space-y-2">
                            <Label htmlFor="comment">Add a comment</Label>
                            <Textarea
                                id="comment"
                                placeholder="Write your comment..."
                                className="min-h-[80px] rounded-md border-border focus-visible:ring-ring"
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                            />
                            <div className="flex justify-end">
                                <Button
                                    size="sm"
                                    className="rounded-md"
                                    onClick={handleAddComment}
                                    disabled={!commentText.trim()}
                                >
                                    <Send className="mr-2 h-3 w-3" />
                                    Add Comment
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
                <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2 pt-4">
                    {" "}
                    {/* Added padding top */}
                    <Button variant="outline" onClick={onClose} className="rounded-md mt-2 sm:mt-0">
                        Close
                    </Button>
                    {onLaunchEditor && (
                        <Button className="rounded-md" onClick={() => onLaunchEditor(task.id)}>
                            {" "}
                            {/* Use task.id */}
                            <Code className="mr-2 h-4 w-4" />
                            Launch Editor
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
