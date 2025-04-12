import { useState, useCallback } from "react";
import { Plus } from "lucide-react"; // Removed unused icons: MessageSquare, Repeat, Send, Sparkles, Zap
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NDKProject } from "@/lib/nostr/events/project";
import { NoteCard, QuoteData } from "@/components/events/note/card"; // Using NoteCard
import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { useNDK, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { CreatePostDialog } from "./CreatePostDialog";
import { CreateIssueDialog } from "./CreateIssueDialog"; // Import CreateIssueDialog
import { toast } from "@/components/ui/use-toast";

interface ActivityFeedProps {
    project: NDKProject;
    signer: NDKPrivateKeySigner;
    // onCreatePost removed
    onReply: (activityId: string, content: string) => void;
    onRepost: (activityId: string) => void;
    onQuote: (quoteData: QuoteData) => void; // Added
    onZap: (activityId: string) => void;
    // We don't need onCreateIssue prop here, we handle it internally
}

export function ActivityFeed({ project, signer, onReply, onRepost, onQuote, onZap }: ActivityFeedProps) { // onCreatePost removed
    const { ndk } = useNDK();
    const projectPubkey = signer.pubkey;
    const { events } = useSubscribe([
        { kinds: [1], authors: [projectPubkey], limit: 50 },
    ], {}, [projectPubkey]);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState("");
    const [isCreatingPost, setIsCreatingPost] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    // State for Create Issue Dialog
    const [isCreateIssueDialogOpen, setIsCreateIssueDialogOpen] = useState(false);
    const [issueInitialContent, setIssueInitialContent] = useState("");
    const handleCreatePostClick = () => setIsCreatingPost(true);

    const handlePostSubmit = useCallback(async (content: string) => {
        // ... (existing post submit logic)
        if (!ndk || !signer || isPublishing) return;
        setIsPublishing(true);
        console.log("Creating post with content:", content);
        try {
            const event = new NDKEvent(ndk);
            event.kind = 1;
            event.content = content;
            // Add project reference tag if needed
            await event.sign(signer);
            await event.publish();
            toast({ title: "Post Published", description: "Your update has been sent to the network." });
            setIsCreatingPost(false);
        } catch (error) {
            console.error("Failed to publish post:", error);
            toast({ title: "Publishing Failed", description: "Could not publish your post.", variant: "destructive" });
        } finally {
            setIsPublishing(false);
        }
    }, [ndk, signer, project, isPublishing]);

    const handleSendReply = (activityId: string) => {
        onReply(activityId, replyContent);
        setReplyContent("");
        setReplyingTo(null);
    };
    // Handler to open the Create Issue dialog
    const handleCreateIssueClick = (content: string) => {
        setIssueInitialContent(content);
        setIsCreateIssueDialogOpen(true);
    };

    // Handler for submitting the new issue
    const handleCreateIssueSubmit = (description: string) => {
        console.log("Creating issue with description:", description);
        // TODO: Implement actual issue creation logic here
        // - Create a Nostr event (e.g., kind 30023 for long-form, or a custom kind)
        // - Tag the project, the original event, etc.
        // - Sign and publish
        toast({ title: "Issue Creation Requested", description: "Issue creation logic not yet implemented." });
        // Close dialog is handled internally by CreateIssueDialog on submit
    };

    return (
        <Card className="rounded-md border-border">
            <CardHeader className="pb-3">
                 <div className="flex items-center justify-between">
                     <CardTitle className="text-xl">Activity Feed</CardTitle>
                     <Button
                         variant="ghost"
                         size="icon"
                         className="h-8 w-8 rounded-md hover:bg-secondary"
                         onClick={handleCreatePostClick}
                     >
                         <Plus className="h-4 w-4" />
                         <span className="sr-only">Create post</span>
                     </Button>
                 </div>
                 <CardDescription>Updates from the project agent</CardDescription>
            </CardHeader>
            <CardContent>
                {projectPubkey}
                <div className="space-y-4">
                    {(() => {
                        const sortedEvents = [...events].sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
                        return sortedEvents.length > 0 ? (
                            sortedEvents.map((event) => (
                                <NoteCard
                                    key={event.id}
                                    event={event}
                                    onRepost={onRepost}
                                    onQuote={onQuote}
                                    onCreateIssue={handleCreateIssueClick} // Pass the handler
                                />
                            ))
                        ) : (
                            <div className="text-center py-6 text-muted-foreground">
                                No activity yet. Create your first post!
                            </div>
                        );
                    })()}
                </div>
            </CardContent>
            {/* Render the Create Post dialog */}
            <CreatePostDialog
                open={isCreatingPost}
                onClose={() => setIsCreatingPost(false)}
                onPost={handlePostSubmit}
                isPosting={isPublishing}
            />
            {/* Render the Create Issue dialog */}
            <CreateIssueDialog
                isOpen={isCreateIssueDialogOpen}
                onClose={() => setIsCreateIssueDialogOpen(false)}
                initialContent={issueInitialContent}
                onSubmit={handleCreateIssueSubmit}
            />
        </Card>
    );
}
