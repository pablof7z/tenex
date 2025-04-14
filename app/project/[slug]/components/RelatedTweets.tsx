import { useMemo, useState, useCallback } from "react"; // Add useState, useCallback
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NDKProject } from "@/lib/nostr/events/project";
import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { NoteCard, QuoteData } from "@/components/events/note/card";
import { CreateIssueDialog } from "./CreateIssueDialog"; // Import CreateIssueDialog
import { toast } from "@/components/ui/use-toast"; // Import toast
import { LoadedProject } from "@/hooks/useProjects";

interface RelatedTweetsProps {
    project: LoadedProject;
}

export function RelatedTweets({ project }: RelatedTweetsProps) {
    const tagsToSubscribe =
        Array.isArray(project.hashtags) && project.hashtags.length > 0 ? project.hashtags : undefined;

    const { events } = useSubscribe(tagsToSubscribe ? [{ kinds: [1], "#t": tagsToSubscribe, limit: 50 }] : false, {}, [
        project.slug,
        tagsToSubscribe,
    ]);

    // State for Create Issue Dialog
    const [isCreateIssueDialogOpen, setIsCreateIssueDialogOpen] = useState(false);
    const [issueInitialContent, setIssueInitialContent] = useState("");

    const sortedEvents = useMemo(() => {
        // ... (existing sort logic)
        return events
            .sort((a, b) => {
                const aTimestamp = a.created_at || 0;
                const bTimestamp = b.created_at || 0;
                return bTimestamp - aTimestamp; // Sort in descending order
            })
            .slice(0, 50);
    }, [events]);

    // Handler to open the Create Issue dialog
    const handleCreateIssueClick = useCallback((content: string) => {
        setIssueInitialContent(content);
        setIsCreateIssueDialogOpen(true);
    }, []); // Use useCallback

    // Handler for submitting the new issue (placeholder)
    const handleCreateIssueSubmit = useCallback((description: string) => {
        console.log("Creating issue from Related Tweet with description:", description);
        // TODO: Implement actual issue creation logic here (similar to ActivityFeed)
        toast({ title: "Issue Creation Requested", description: "Issue creation logic not yet implemented." });
    }, []); // Use useCallback

    return (
        <Card className="rounded-md border-border">
            <CardHeader className="pb-3">
                {/* ... Card Header content ... */}
                <CardTitle className="text-xl">Related Tweets</CardTitle>
                <CardDescription>
                    Conversations about{" "}
                    {project.hashtags?.map((tag) => (
                        <span
                            key={tag}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground mr-1"
                        >
                            #{tag}
                        </span>
                    ))}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {events.length === 0 && (
                        <p className="text-sm text-muted-foreground">No related tweets found yet.</p>
                    )}
                    {sortedEvents.map((event) => (
                        <NoteCard
                            key={event.id}
                            event={event}
                            // Reply props removed - NoteCard handles its own internal reply state/UI
                            // The reply state/handlers in RelatedTweets are for its *own* reply feature, if different.
                            // onRepost, onQuote, onZap removed - handled by NoteCard
                            onCreateIssue={handleCreateIssueClick} // Pass the handler
                        />
                    ))}
                </div>
            </CardContent>
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
