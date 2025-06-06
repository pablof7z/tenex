import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk"; // Removed NDKEvent
import { useNDK, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { Plus } from "lucide-react"; // Removed unused icons: MessageSquare, Repeat, Send, Sparkles, Zap
import { useCallback, useState } from "react";
import { CreateIssueDialog } from "@/app/project/[slug]/components/CreateIssueDialog";
import { CreatePostDialog } from "@/app/project/[slug]/components/CreatePostDialog";
import { NoteCard, QuoteData } from "@/components/events/note/card"; // Using NoteCard
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast"; // Keep toast for issue creation feedback
import { NDKProject } from "@/lib/nostr/events/project";

interface ActivityFeedProps {
    pubkeys: string[];
    signer?: NDKPrivateKeySigner;
}

export function ActivityFeed({ pubkeys, signer }: ActivityFeedProps) {
    const { ndk } = useNDK();
    const { events } = useSubscribe([{ kinds: [1], authors: pubkeys, limit: 50 }], {}, [pubkeys.join(",")]);
    const [isCreatingPost, setIsCreatingPost] = useState(false);

    // State for Create Issue Dialog
    const [isCreateIssueDialogOpen, setIsCreateIssueDialogOpen] = useState(false);
    const [issueInitialContent, setIssueInitialContent] = useState("");
    const handleCreatePostClick = () => setIsCreatingPost(true);

    // Removed handlePostSubmit - logic moved to CreatePostDialog
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
                <CardDescription>Updates from agents</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {(() => {
                        const sortedEvents = [...events].sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
                        return sortedEvents.length > 0 ? (
                            sortedEvents.map((event) => (
                                <NoteCard key={event.id} event={event} onCreateIssue={handleCreateIssueClick} />
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
            {signer && (
                <CreatePostDialog open={isCreatingPost} onClose={() => setIsCreatingPost(false)} signer={signer} />
            )}
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
