import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NDKProject } from "@/lib/nostr/events/project";
import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { NoteCard, QuoteData } from "@/components/events/note/card";

interface RelatedTweetsProps {
    project: NDKProject;
    onReply: (tweetId: string, content: string) => void;
    onRepost: (tweetId: string) => void;
    onQuote: (quoteData: QuoteData) => void;
    onZap: (tweetId: string) => void;
}

export function RelatedTweets({ project, onReply, onRepost, onQuote, onZap }: RelatedTweetsProps) {
    // Ensure project.hashtags is an array before using it in the filter
    const tagsToSubscribe = Array.isArray(project.hashtags) && project.hashtags.length > 0 ? project.hashtags : undefined;

    const { events } = useSubscribe(tagsToSubscribe ? [
        { kinds: [1], "#t": tagsToSubscribe, limit: 50 },
    ] : false, {}, [ project.id, tagsToSubscribe])
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState("");

    const sortedEvents = useMemo(() => {
        return events.sort((a, b) => {
            const aTimestamp = a.created_at || 0;
            const bTimestamp = b.created_at || 0;
            return bTimestamp - aTimestamp; // Sort in descending order
        })
            .slice(0, 50);
    }, [events]);

    const handleSendReply = (tweetId: string) => {
        // Ensure content is trimmed and not empty before sending
        const trimmedContent = replyContent.trim();
        if (trimmedContent) {
            onReply(tweetId, trimmedContent);
            setReplyContent("");
            setReplyingTo(null); // Also close reply box on send
        }
        setReplyingTo(null);
    };

    return (
        <Card className="rounded-md border-border">
            <CardHeader className="pb-3">
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
                            isReplying={replyingTo === event.id}
                            replyContent={replyingTo === event.id ? replyContent : ""} // Only pass content if replying to this tweet
                            onReplyContentChange={setReplyContent}
                            onShowReply={setReplyingTo}
                            onCancelReply={() => setReplyingTo(null)}
                            onSendReply={handleSendReply}
                            onRepost={onRepost}
                            onQuote={onQuote} // Pass the handler directly
                            onZap={onZap}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
