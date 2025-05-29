import { useState, useCallback } from "react";
import { NDKEvent, NDKUser } from "@nostr-dev-kit/ndk";
import { MessageSquare, Repeat, Send, Zap, Plus } from "lucide-react"; // Import Plus
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { QuoteData } from "@/components/events/note/card";
import UserAvatar from "@/components/user/avatar";
import { CommitLabel } from "@/components/ui/commit-label";
import { useGitOperations } from "@/hooks/useGitOperations";

interface TweetCardProps {
    event: NDKEvent;
    isReplying: boolean;
    replyContent: string;
    onReplyContentChange: (content: string) => void;
    onShowReply: (eventId: string) => void;
    onCancelReply: () => void;
    onSendReply: (eventId: string) => void;
    onRepost: (eventId: string) => void;
    onQuote: (quoteData: QuoteData) => void;
    onZap: (eventId: string) => void;
    onCreateIssue: (content: string) => void; // Add new prop
}

// Function to format timestamp (Example)
const formatTimestamp = (timestamp: number | undefined): string => {
    if (!timestamp) return "";
    const date = new Date(timestamp * 1000);
    return date.toLocaleString(); // Adjust formatting as needed
};

// Function to get author display name
const getAuthorDisplayName = (author: NDKUser): string => {
    return author.profile?.displayName || author.profile?.name || author.npub.substring(0, 12) + "...";
};

// Function to get author handle (npub or nprofile)
const getAuthorHandle = (author: NDKUser): string => {
    // Prefer npub for simplicity here, adjust if nprofile is needed
    return author.npub;
};

export function TweetCard({
    event,
    isReplying,
    replyContent,
    onReplyContentChange,
    onShowReply,
    onCancelReply,
    onSendReply,
    onRepost,
    onQuote,
    onZap,
    onCreateIssue, // Destructure new prop
}: TweetCardProps) {
    // Note: Repost count and Zap amount require fetching related events (kind 6 for reposts, kind 9735 for zaps)
    // This basic component doesn't include that logic yet.
    const repostCount = 0; // Placeholder
    const zapAmount = 0; // Placeholder

    const authorDisplayName = getAuthorDisplayName(event.author);
    const authorHandle = getAuthorHandle(event.author);
    
    // Git operations hook
    const { resetToCommit } = useGitOperations();

    const handleQuote = () => {
        onQuote({
            id: event.id,
            content: event.content,
            User: authorDisplayName, // Use display name for quote context (Matches NoteCard's QuoteData)
            pubkey: event.pubkey, // Pass pubkey for potential NIP-19 encoding
            nevent: event.encode(), // Pass nevent for better referencing
        });
    };

    // Git reset handler for commit labels
    const handleCommitReset = useCallback(async (commitHash: string) => {
        try {
            const result = await resetToCommit(commitHash, { resetType: 'mixed' });
            if (!result.success) {
                throw new Error(result.message || 'Reset failed');
            }
        } catch (error) {
            // Error handling is done in the CommitLabel component
            throw error;
        }
    }, [resetToCommit]);

    return (
        <div className="border-b border-border pb-3 last:border-0">
            <div className="flex items-start gap-3">
                <UserAvatar pubkey={event.pubkey} size="lg" />
                <div className="flex-1">
                    <div className="flex items-center gap-1">
                        <span className="font-medium text-sm">{authorDisplayName}</span>
                        <span className="text-xs text-muted-foreground">@{authorHandle.substring(0, 8)}...</span>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{event.content}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{formatTimestamp(event.created_at)}</span>
                        {/* Display commit hash prefix if available */}
                        {event.tagValue('commit') && (
                            <div className="flex items-center gap-1 ml-2">
                                <CommitLabel
                                    commitHash={event.tagValue('commit')!}
                                    showDropdown={true}
                                    onReset={handleCommitReset}
                                    size="md"
                                />
                            </div>
                        )}
                        {/* Display confidence level if available */}
                        {event.tagValue('confidence') && (
                            <div className="flex items-center gap-1 ml-2">
                                <span className="font-medium">Confidence:</span>
                                <span className="bg-secondary px-1.5 py-0.5 rounded-md">{event.tagValue('confidence')}/10</span>
                            </div>
                        )}
                        {/* Add other metadata like relays if needed */}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                        {isReplying ? (
                            <div className="mt-3 space-y-2 w-full">
                                <Textarea
                                    placeholder="Write your reply..."
                                    className="min-h-[80px] rounded-md border-border focus-visible:ring-ring"
                                    value={replyContent}
                                    onChange={(e) => onReplyContentChange(e.target.value)}
                                />
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={onCancelReply} className="rounded-md">
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="rounded-md"
                                        onClick={() => onSendReply(event.id)}
                                        disabled={!replyContent.trim()}
                                    >
                                        <Send className="mr-2 h-3 w-3" />
                                        Send
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-md hover:bg-secondary h-8 px-2"
                                    onClick={() => onShowReply(event.id)}
                                >
                                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                                    Reply
                                </Button>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="rounded-md hover:bg-secondary h-8 px-2"
                                        >
                                            <Repeat className="h-3.5 w-3.5 mr-1.5" />
                                            {repostCount > 0 && <span className="text-xs">{repostCount}</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48 p-2">
                                        <div className="grid gap-1">
                                            <Button
                                                variant="ghost"
                                                className="justify-start h-8 px-2 text-sm"
                                                onClick={() => onRepost(event.id)}
                                            >
                                                <Repeat className="h-3.5 w-3.5 mr-2" />
                                                Repost
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                className="justify-start h-8 px-2 text-sm"
                                                onClick={handleQuote}
                                            >
                                                <MessageSquare className="h-3.5 w-3.5 mr-2" />
                                                Quote
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-md hover:bg-secondary h-8 px-2"
                                    onClick={() => onZap(event.id)}
                                >
                                    <Zap className="h-3.5 w-3.5 mr-1.5" />
                                    {zapAmount > 0 && (
                                        <span className="text-xs">{zapAmount}</span> // Needs formatting if large
                                    )}
                                </Button>

                                {/* Add Create Issue Button */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-md hover:bg-secondary h-8 px-2"
                                    onClick={() => onCreateIssue(event.content)}
                                >
                                    <Plus className="h-3.5 w-3.5" /> {/* Use Plus icon */}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
