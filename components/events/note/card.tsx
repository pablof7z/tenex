import React, { useState, useCallback } from 'react'; // Import useState, useCallback
import { NDKEvent, NDKUser, NDKUserProfile, NostrEvent } from "@nostr-dev-kit/ndk";
import { useNDK } from "@nostr-dev-kit/ndk-hooks"; // Only need useNDK
import { MessageSquare, Repeat, Send, Zap, Plus, Loader2 } from "lucide-react"; // Import Plus, Loader2
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import UserAvatar from "../../user/avatar";
import { useProfile } from "@nostr-dev-kit/ndk-hooks";
import { toast } from "@/components/ui/use-toast"; // Import toast

// Define QuoteData interface here to avoid circular dependencies
export interface QuoteData {
    id: string;
    content: string;
    User: string;
    pubkey: string;
    nevent?: string;
}

interface NoteCardProps {
    event: NDKEvent;
    // Removed reply/zap related props
    onRepost: (eventId: string) => void; // Keep repost/quote props
    onQuote: (quoteData: QuoteData) => void;
    onCreateIssue?: (content: string) => void; // Keep optional prop
}

// Function to format timestamp
const formatTimestamp = (timestamp: number | undefined): string => {
    if (!timestamp) return "";
    const date = new Date(timestamp * 1000);
    return date.toLocaleString(); // Adjust formatting as needed
};

// Function to get User display name
const getUserDisplayName = (profile: NDKUserProfile | undefined, user: NDKUser): string => {
    return profile?.displayName || profile?.name || user.npub.substring(0, 12) + "...";
};

// Function to get User handle (npub or nprofile)
const getUserHandle = (profile: NDKUserProfile | undefined, user: NDKUser): string => {; // Add semicolon
    // Prefer npub for simplicity here, adjust if nprofile is needed
    return profile?.nip05 ?? user.npub;
};

export function NoteCard({
    event,
    onRepost,
    onQuote,
    onCreateIssue,
}: NoteCardProps) {
    const { ndk } = useNDK(); // Get NDK instance
    // Signer is obtained from ndk instance (ndk.signer) implicitly during event.sign()
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [internalReplyContent, setInternalReplyContent] = useState("");
    const [isSendingReply, setIsSendingReply] = useState(false);
    const [isZapping, setIsZapping] = useState(false); // State for zap loading/disabled

    // Note: Repost count and Zap amount require fetching related events (kind 6 for reposts, kind 9735 for zaps)
    // This basic component doesn't include that logic yet.
    const repostCount = 0; // Placeholder
    const zapAmount = 0; // Placeholder

    const profile = useProfile(event.pubkey);
    const user = event.author;
    const UserDisplayName = getUserDisplayName(profile, user);
    const UserHandle = getUserHandle(profile, user);

    const handleQuote = () => {
        onQuote({
            id: event.id,
            content: event.content,
            User: UserDisplayName, // Use display name for quote context
            pubkey: event.pubkey, // Pass pubkey for potential NIP-19 encoding
            nevent: event.encode() // Pass nevent for better referencing
        });
    };

    // --- Internal Handlers ---
    const handleShowReplyClick = useCallback(() => {
        setShowReplyInput(true);
    }, []);

    const handleCancelReplyClick = useCallback(() => {
        setShowReplyInput(false);
        setInternalReplyContent("");
    }, []);

    const handleReplyContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInternalReplyContent(e.target.value);
    }, []);

    const handleSendReplyClick = useCallback(async () => {; // Add semicolon
        // Check if NDK instance and its signer are available
        if (!ndk?.signer || !internalReplyContent.trim()) {
            toast({ title: "Error", description: "Cannot send reply. Signer not available or content empty.", variant: "destructive" });
            return;
        }
        setIsSendingReply(true);
        try {
            const replyEvent = new NDKEvent(ndk);
            replyEvent.kind = 1;
            replyEvent.content = internalReplyContent;
            // Basic reply tagging: tag original event and author
            replyEvent.tags = [
                ["e", event.id, "", "reply"], // Tag event being replied to
                ["p", event.pubkey] // Tag author being replied to
            ];
            // Add root tag if the original event is also a reply
            const rootTag = event.tags.find(t => t[0] === 'e' && t[3] === 'root');
            if (rootTag) {
                replyEvent.tags.push(rootTag); // Keep the root tag
                // Ensure the direct reply tag is marked as 'reply'
                const replyTagIndex = replyEvent.tags.findIndex(t => t[0] === 'e' && t[1] === event.id);
                if (replyTagIndex !== -1 && replyEvent.tags[replyTagIndex].length < 4) {
                    replyEvent.tags[replyTagIndex][3] = 'reply';
                }
            } else {
                 // If original is not a reply, mark its 'e' tag as root
                 const replyTagIndex = replyEvent.tags.findIndex(t => t[0] === 'e' && t[1] === event.id);
                 if (replyTagIndex !== -1) {
                     replyEvent.tags[replyTagIndex][3] = 'root';
                 }
            }


            // TODO: Add mentions tagging if needed (parse content for @npub, @note, etc.)

            await replyEvent.sign(); // Use ndk.signer implicitly
            console.log("Publishing reply event:", replyEvent.id); // Log ID before publishing
            await replyEvent.publish();

            toast({ title: "Success", description: "Reply sent!" });
            setShowReplyInput(false);
            setInternalReplyContent("");
        } catch (error) {
            console.error("Failed to send reply:", error);
            toast({ title: "Error", description: `Failed to send reply: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
        } finally {
            setIsSendingReply(false);
        }
    }, [ndk, event, internalReplyContent]); // Removed signer from dependencies

    const handleZapClick = useCallback(async () => {
        // Basic Zap Implementation (Placeholder)
        setIsZapping(true);
        console.log("Attempting to zap event:", event.id, "by author:", event.pubkey);
        toast({ title: "Zap", description: "Zap functionality not fully implemented yet." });
        // TODO: Implement NIP-57 Zap logic here
        // 1. Fetch user profile for lud16/lud06
        // 2. Construct zap request event (kind 9734)
        // 3. Sign zap request
        // 4. Make request to LNURL endpoint
        // 5. Handle payment (WebLN?)
        // 6. Publish zap receipt (kind 9735) - optional but good practice
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate async operation
        setIsZapping(false);
    }, [event]);
    // --- End Internal Handlers ---


    return (
        <div className="border-b border-border pb-3 last:border-0">
            <div className="flex items-start gap-3">
                <UserAvatar pubkey={event.pubkey} size='lg' />
                <div className="flex-1">
                    <div className="flex items-center gap-1">
                        <span className="font-medium text-sm">{UserDisplayName}</span>
                        <span className="text-xs text-muted-foreground">@{UserHandle.substring(0, 8)}...</span>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{event.content}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{formatTimestamp(event.created_at)}</span>
                        {/* Add other metadata like relays if needed */}
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-2"> {/* Add justify-between */}
                        {showReplyInput ? (
                            <div className="mt-3 space-y-2 w-full">
                                <Textarea
                                    placeholder="Write your reply..."
                                    className="min-h-[80px] rounded-md border-border focus-visible:ring-ring"
                                    value={internalReplyContent}
                                    onChange={handleReplyContentChange}
                                    disabled={isSendingReply}
                                />
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCancelReplyClick}
                                        className="rounded-md"
                                        disabled={isSendingReply}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="rounded-md"
                                        onClick={handleSendReplyClick}
                                        disabled={!internalReplyContent.trim() || isSendingReply}
                                    >
                                        {isSendingReply ? (
                                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                        ) : (
                                            <Send className="mr-2 h-3 w-3" />
                                        )}
                                        Send
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Wrapper for left-aligned buttons */}
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="rounded-md hover:bg-secondary h-8 px-2"
                                        onClick={handleShowReplyClick} // Use internal handler
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
                                                {repostCount > 0 && (
                                                    <span className="text-xs">{repostCount}</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-48 p-2">
                                            <div className="grid gap-1">
                                                <Button
                                                    variant="ghost"
                                                    className="justify-start h-8 px-2 text-sm"
                                                    onClick={() => onRepost(event.id)} // Keep external repost
                                                >
                                                    <Repeat className="h-3.5 w-3.5 mr-2" />
                                                    Repost
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className="justify-start h-8 px-2 text-sm"
                                                    onClick={handleQuote} // Keep external quote
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
                                        onClick={handleZapClick} // Use internal handler
                                        disabled={isZapping} // Disable while zapping
                                    >
                                        {isZapping ? (
                                             <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                        ) : (
                                             <Zap className="h-3.5 w-3.5 mr-1.5" />
                                        )}
                                        {zapAmount > 0 && !isZapping && (
                                            <span className="text-xs">{zapAmount}</span>
                                        )}
                                    </Button>
                                </div>

                                {/* Right-aligned button */}
                                {onCreateIssue && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="rounded-md hover:bg-secondary h-8 px-2"
                                        onClick={() => onCreateIssue(event.content)}
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}