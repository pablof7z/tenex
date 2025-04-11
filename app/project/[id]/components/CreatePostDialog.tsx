import { useState } from "react";
import { Send, Loader2 } from "lucide-react"; // Added Loader2 for loading state
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface CreatePostDialogProps {
    open: boolean;
    onClose: () => void;
    onPost: (content: string) => void;
    isPosting?: boolean; // Added optional isPosting prop
}

export function CreatePostDialog({ open, onClose, onPost, isPosting = false }: CreatePostDialogProps) { // Destructure isPosting with default
    const [content, setContent] = useState(""); // Keep local content state

    const handlePost = () => {
        if (content.trim()) {
            onPost(content);
            setContent("");
            onClose();
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] rounded-md">
                <DialogHeader>
                    <DialogTitle>Create Post</DialogTitle>
                    <DialogDescription>Post as the project agent to the project feed</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Textarea
                        placeholder="What's happening with the project?"
                        className="min-h-[120px] rounded-md border-border focus-visible:ring-ring"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                            Posting as <span className="font-medium">Project Agent</span>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} className="rounded-md">
                        Cancel
                    </Button>
                    <Button onClick={handlePost} className="rounded-md" disabled={!content.trim() || isPosting}>
                        {isPosting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="mr-2 h-4 w-4" />
                        )}
                        {isPosting ? "Posting..." : "Post"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
