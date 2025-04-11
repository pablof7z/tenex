import { useState, useCallback } from "react";
import { Plus } from "lucide-react"; // Removed unused icons: MessageSquare, Repeat, Send, Sparkles, Zap
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NDKProject } from "@/lib/nostr/events/project";
import { NoteCard, QuoteData } from "@/components/events/note/card";
import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { useNDK, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { CreatePostDialog } from "./CreatePostDialog"; // Import the dialog
import { toast } from "@/components/ui/use-toast";

interface ActivityFeedProps {
    project: NDKProject;
    signer: NDKPrivateKeySigner;
    // onCreatePost removed
    onReply: (activityId: string, content: string) => void;
    onRepost: (activityId: string) => void;
    onQuote: (quoteData: QuoteData) => void; // Added
    onZap: (activityId: string) => void;
}

export function ActivityFeed({ project, signer, onReply, onRepost, onQuote, onZap }: ActivityFeedProps) { // onCreatePost removed
    const { ndk } = useNDK();
    const projectPubkey = signer.pubkey;
    const { events } = useSubscribe([
        { kinds: [1], authors: [projectPubkey], limit: 50 },
    ], {}, [projectPubkey]);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState("");
    const [isCreatingPost, setIsCreatingPost] = useState(false); // State for dialog visibility
    const [isPublishing, setIsPublishing] = useState(false); // State for publishing status

    const handleCreatePostClick = () => setIsCreatingPost(true);

    const handlePostSubmit = useCallback(async (content: string) => {
        if (!ndk || !signer || isPublishing) return;
        setIsPublishing(true);
        console.log("Creating post with content:", content);
        try {
            const event = new NDKEvent(ndk);
            event.kind = 1;
            event.content = content;
            // Add project reference tag if needed, e.g., event.tags.push(['a', `${project.kind}:${project.pubkey}:${project.identifier}`]);
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
    }, [ndk, signer, project, isPublishing]); // Added dependencies

    const handleSendReply = (activityId: string) => {
        onReply(activityId, replyContent);
        setReplyContent("");
        setReplyingTo(null);
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
                        onClick={handleCreatePostClick} // Updated onClick
                    >
                        <Plus className="h-4 w-4" />
                        <span className="sr-only">Create post</span>
                    </Button>
                </div>
                <CardDescription>Updates from the project agent</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {(() => { // IIFE to allow sorting logic before mapping
                        const sortedEvents = [...events].sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
                        return sortedEvents.length > 0 ? (
                            sortedEvents.map((event) => (
                            <NoteCard
                                key={event.id}
                                event={event}
                                isReplying={replyingTo === event.id}
                                replyContent={replyContent}
                                onReplyContentChange={setReplyContent}
                                onShowReply={setReplyingTo}
                                onCancelReply={() => setReplyingTo(null)}
                                onSendReply={handleSendReply}
                                onRepost={onRepost}
                                onQuote={onQuote} // Pass the onQuote prop down
                                onZap={onZap}
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
            {/* Render the dialog inside the Card, after CardContent */}
            <CreatePostDialog
                open={isCreatingPost}
                onClose={() => setIsCreatingPost(false)}
                onPost={handlePostSubmit}
                isPosting={isPublishing} // Pass publishing state
            />
        </Card>
    );
}
