import { NoteCard, QuoteData } from "@/components/events/note/card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast"; // Import toast
import type { LoadedProject } from "@/hooks/useProjects";
import { useTweetSelection } from "@/hooks/useTweetSelection";
import { NDKProject } from "@/lib/nostr/events/project";
import { NDKTask } from "@/lib/nostr/events/task";
import { useNDK, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { Loader2, Plus, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react"; // Add useState, useCallback
import { CreateIssueDialog } from "./CreateIssueDialog"; // Import CreateIssueDialog

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

    // Tweet selection functionality
    const { selectedTweetIds, selectedCount, toggleTweet, clearSelection, getSelectedTweets } =
        useTweetSelection(events);

    // State for Create Issue Dialog
    const [isCreateIssueDialogOpen, setIsCreateIssueDialogOpen] = useState(false);
    const [issueInitialContent, setIssueInitialContent] = useState("");

    // State for task creation
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const { ndk } = useNDK();

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

    // Handler to create task from selected tweets
    const handleCreateTask = useCallback(async () => {
        const selectedTweets = getSelectedTweets();

        if (selectedTweets.length === 0) {
            toast({
                title: "No tweets selected",
                description: "Please select at least one tweet to create a task.",
                variant: "destructive",
            });
            return;
        }

        setIsCreatingTask(true);

        try {
            if (!ndk) throw new Error("NDK instance is not available.");

            // Concatenate tweet content with separators
            const tweetContents = selectedTweets.map((tweet) => tweet.content.trim());
            const concatenatedContent = tweetContents.join("\n\n----\n\n");

            // Add nevent references at the end
            const neventReferences = selectedTweets.map((tweet) => tweet.encode());
            const finalContent = `${concatenatedContent}\n\nRelated events:\n${neventReferences.join("\n")}`;

            // Generate a title from the first tweet (truncated)
            const firstTweetContent = selectedTweets[0].content.trim();
            const taskTitle =
                firstTweetContent.length > 60 ? `${firstTweetContent.substring(0, 60)}...` : firstTweetContent;

            console.log("Creating NDKTask from selected tweets...");
            const task = new NDKTask(ndk);
            task.title = taskTitle;
            task.content = finalContent;
            if (project.event) task.project = project.event;

            console.log("Getting project signer...");
            const projectSigner = await project.signer;
            task.pubkey = projectSigner.pubkey;
            console.log("Task pubkey set to:", task.pubkey);

            console.log("Signing task event...");
            await task.sign(projectSigner);
            console.log("Publishing task event...");
            await task.publish();
            console.log("Task event published successfully.");

            toast({
                title: "Task Created",
                description: `Task created from ${selectedTweets.length} tweet${selectedTweets.length > 1 ? "s" : ""}.`,
            });

            // Clear selection after successful task creation
            clearSelection();
        } catch (error: unknown) {
            console.error("Failed to create task from tweets:", error);
            toast({
                title: "Error Creating Task",
                description: error instanceof Error ? error.message : "An unknown error occurred.",
                variant: "destructive",
            });
        } finally {
            setIsCreatingTask(false);
        }
    }, [getSelectedTweets, clearSelection, ndk, project]);

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
                {/* Create task button - appears when tweets are selected */}
                {selectedCount > 0 && (
                    <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <Plus className="h-4 w-4 text-primary" />
                                    <span className="font-medium text-primary">
                                        {selectedCount} tweet{selectedCount > 1 ? "s" : ""} selected
                                    </span>
                                </div>
                                <Button
                                    size="sm"
                                    className="bg-primary hover:bg-primary/90"
                                    onClick={handleCreateTask}
                                    disabled={isCreatingTask}
                                    aria-label={`Create task from ${selectedCount} selected tweets`}
                                >
                                    {isCreatingTask ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Creating task...
                                        </>
                                    ) : (
                                        <>
                                            Create task from {selectedCount} tweet{selectedCount > 1 ? "s" : ""}
                                        </>
                                    )}
                                </Button>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearSelection}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label="Clear selection"
                            >
                                <X className="h-4 w-4" />
                                Clear
                            </Button>
                        </div>
                    </div>
                )}

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
                            // Tweet selection props
                            showCheckbox={true}
                            isSelected={selectedTweetIds.has(event.id)}
                            onToggleSelection={toggleTweet}
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
