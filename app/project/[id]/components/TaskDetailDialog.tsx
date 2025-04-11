import { useState } from "react";
import { Code, Send } from "lucide-react";
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
import { Task } from "./types";

interface TaskDetailDialogProps {
    task: Task | null;
    onClose: () => void;
    onAddComment?: (taskId: string, comment: string) => void;
    onLaunchEditor?: (taskId: string) => void;
}

export function TaskDetailDialog({ task, onClose, onAddComment, onLaunchEditor }: TaskDetailDialogProps) {
    const [commentText, setCommentText] = useState("");

    if (!task) return null;

    const handleAddComment = () => {
        if (commentText.trim() && onAddComment) {
            onAddComment(task.id, commentText);
            setCommentText("");
        }
    };

    return (
        <Dialog open={!!task} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] rounded-md">
                <DialogHeader>
                    <DialogTitle className="text-xl">{task.title}</DialogTitle>
                    <DialogDescription>
                        Created by <span className="font-medium">@{task.creatorName}</span> • {task.createdAt}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    {task.references > 0 && (
                        <div>
                            <h4 className="text-sm font-medium mb-2">Referenced Items ({task.references})</h4>
                            <div className="space-y-3 border rounded-md p-4 bg-secondary/50 border-border">
                                {/* Mock referenced items - in a real app, these would be fetched */}
                                <div className="border-b border-border pb-3">
                                    <p className="text-sm">
                                        Just saw an amazing visualization of the #nostr network. The social connections
                                        are fascinating!
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        <span className="font-medium">@nostr_dev</span> • 5 hours ago
                                    </p>
                                </div>
                                <div className="border-b border-border pb-3">
                                    <p className="text-sm">
                                        Working on some new #visualization techniques that could be perfect for #nostr
                                        social graphs
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        <span className="font-medium">@viz_expert</span> • 1 day ago
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm">
                                        The intersection of #bitcoin and #nostr communities is clearly visible in these
                                        new social graphs
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        <span className="font-medium">@bitcoin_enthusiast</span> • 2 days ago
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Comments section */}
                    <div>
                        <h4 className="text-sm font-medium mb-2">Comments ({task.comments?.length || 0})</h4>
                        <div className="space-y-3 border rounded-md p-4 bg-secondary/50 border-border mb-4">
                            {task.comments && task.comments.length > 0 ? (
                                task.comments.map((comment) => (
                                    <div key={comment.id} className="border-b border-border pb-3 last:border-0">
                                        <p className="text-sm">{comment.content}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            <span className="font-medium">@{comment.authorName}</span> •{" "}
                                            {comment.timestamp}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">No comments yet</p>
                            )}
                        </div>

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
                <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2">
                    <Button variant="outline" onClick={onClose} className="rounded-md mt-2 sm:mt-0">
                        Close
                    </Button>
                    {onLaunchEditor && (
                        <Button className="rounded-md" onClick={() => onLaunchEditor(task.id)}>
                            <Code className="mr-2 h-4 w-4" />
                            Launch Editor
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
