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
import { Send } from "lucide-react";
import { useState } from "react";
import type { QuoteData } from "./types";

interface QuotePostDialogProps {
    quoting: QuoteData | null;
    onClose: () => void;
    onQuote: (quoteData: QuoteData, comment: string) => void;
}

export function QuotePostDialog({ quoting, onClose, onQuote }: QuotePostDialogProps) {
    const [comment, setComment] = useState("");

    const handleQuote = () => {
        if (comment.trim() && quoting) {
            onQuote(quoting, comment);
            setComment("");
            onClose();
        }
    };

    if (!quoting) return null;

    return (
        <Dialog open={!!quoting} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] rounded-md">
                <DialogHeader>
                    <DialogTitle>Quote Post</DialogTitle>
                    <DialogDescription>Add your thoughts to this post</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Textarea
                        placeholder="Add your comment..."
                        className="min-h-[100px] rounded-md border-border focus-visible:ring-ring"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />

                    <div className="border rounded-md p-3 bg-secondary/30 border-border">
                        <div className="text-sm font-medium mb-1">@{quoting.author}</div>
                        <div className="text-sm text-muted-foreground">{quoting.content}</div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} className="rounded-md">
                        Cancel
                    </Button>
                    <Button onClick={handleQuote} className="rounded-md" disabled={!comment.trim()}>
                        <Send className="mr-2 h-4 w-4" />
                        Quote
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
