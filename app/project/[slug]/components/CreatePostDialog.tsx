import { useState, useCallback } from "react"; // Added useCallback
import { Send, Loader2 } from "lucide-react";
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
import { useNDK } from "@nostr-dev-kit/ndk-hooks"; // Import useNDK
import NDK, { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk"; // Corrected NDK import
import { toast } from "@/components/ui/use-toast"; // Added toast

interface CreatePostDialogProps {
    open: boolean;
    onClose: () => void;
    // ndk: NDK | null; // Removed ndk prop
    signer: NDKPrivateKeySigner | null; // Added signer prop
}

export function CreatePostDialog({ open, onClose, signer }: CreatePostDialogProps) {
    // Removed ndk from props
    const { ndk } = useNDK(); // Get NDK instance from hook
    const [content, setContent] = useState("");
    const [isPublishing, setIsPublishing] = useState(false); // Moved isPublishing state here

    // Moved post submission logic here
    const handlePostSubmit = useCallback(async () => {
        if (!ndk || !signer || isPublishing || !content.trim()) return;
        setIsPublishing(true);
        console.log("Creating post with content:", content);
        try {
            const event = new NDKEvent(ndk);
            event.kind = 1;
            event.content = content;
            // Add project reference tag if needed (consider adding project context if required)
            await event.sign(signer);
            await event.publish();
            toast({ title: "Post Published", description: "Your update has been sent to the network." });
            setContent(""); // Clear content on success
            onClose(); // Close dialog on success
        } catch (error) {
            console.error("Failed to publish post:", error);
            toast({ title: "Publishing Failed", description: "Could not publish your post.", variant: "destructive" });
        } finally {
            setIsPublishing(false);
        }
        // Ensure ndk is available before proceeding
        if (!ndk) {
            console.error("NDK instance is not available.");
            toast({ title: "Error", description: "NDK is not initialized.", variant: "destructive" });
            return;
        }
    }, [ndk, signer, isPublishing, content, onClose]); // Keep ndk in dependency array

    // Renamed handlePost to trigger the submission logic
    const handleTriggerPost = () => {
        handlePostSubmit(); // Call the actual submission logic
    };

    // Close handler ensures state is reset if dialog is closed externally
    const handleClose = () => {
        if (!isPublishing) {
            setContent(""); // Reset content if not publishing
            onClose();
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            {" "}
            {/* Use handleClose */}
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
                        disabled={isPublishing} // Disable textarea while publishing
                    />
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                            Posting as <span className="font-medium">Project Agent</span>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} className="rounded-md" disabled={isPublishing}>
                        {" "}
                        {/* Use handleClose */}
                        Cancel
                    </Button>
                    <Button
                        onClick={handleTriggerPost}
                        className="rounded-md"
                        disabled={!content.trim() || isPublishing}
                    >
                        {isPublishing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="mr-2 h-4 w-4" />
                        )}
                        {isPublishing ? "Posting..." : "Post"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
