import React, { useState, useCallback, useEffect } from "react";
import NDK, { NDKEvent, NDKUser, NDKUserProfile, NostrEvent } from "@nostr-dev-kit/ndk"; // Import NDK default
import { useNDK, useProfile } from "@nostr-dev-kit/ndk-hooks"; // Import useProfile here
import { MessageSquare, Repeat, Send, Zap, Plus, Loader2, MoreHorizontal, Copy, Eye } from "lucide-react"; // Import necessary icons
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import UserAvatar from "../../user/avatar";
import { toast } from "@/components/ui/use-toast";
import { QuotePostDialog } from "@/app/project/[slug]/components/QuotePostDialog"; // Import QuotePostDialog
import TaggedTask from "../TaggedTask";

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
    // onRepost prop removed, handled internally
    // onQuote: (quoteData: QuoteData) => void; // Removed
    onCreateIssue?: (content: string) => void; // Keep optional prop

    // whehter to skip the tagged task label
    skipTaggedTask: boolean;
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
const getUserHandle = (profile: NDKUserProfile | undefined, user: NDKUser): string => {
    // Add semicolon
    // Prefer npub for simplicity here, adjust if nprofile is needed
    return profile?.nip05 ?? profile?.name ?? user.npub;
};

export function NoteCard({
    event,
    onCreateIssue,
    skipTaggedTask,
}: NoteCardProps) {
    const { ndk } = useNDK(); // Get NDK instance
    // Signer is obtained from ndk instance (ndk.signer) implicitly during event.sign()
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [internalReplyContent, setInternalReplyContent] = useState("");
    const [isSendingReply, setIsSendingReply] = useState(false);
    const [isZapping, setIsZapping] = useState(false);
    const [quoteDataForDialog, setQuoteDataForDialog] = useState<QuoteData | null>(null); // State for Quote Dialog
    const [isQuoting, setIsQuoting] = useState(false); // Loading state for quoting

    const [showRawEventDialog, setShowRawEventDialog] = useState(false);
    // Note: Repost count and Zap amount require fetching related events (kind 6 for reposts, kind 9735 for zaps)
    // This basic component doesn't include that logic yet.
    const repostCount = 0; // Placeholder
    const zapAmount = 0; // Placeholder

    const profile = useProfile(event.pubkey);
    const user = event.author;
    const UserDisplayName = getUserDisplayName(profile, user);
    const UserHandle = getUserHandle(profile, user);

    // Renamed handleQuote to handleOpenQuoteDialog
    const handleOpenQuoteDialog = () => {
        setQuoteDataForDialog({
            id: event.id,
            content: event.content,
            User: UserDisplayName,
            pubkey: event.pubkey,
            nevent: event.encode(),
        });
    };

    // New handler for submitting the quote from the dialog
    const handleQuoteSubmit = useCallback(
        async (originalQuoteData: QuoteData, comment: string) => {
            if (!ndk?.signer || !comment.trim() || !originalQuoteData.nevent) {
                toast({
                    title: "Error",
                    description: "Cannot quote post. Signer or required data missing.",
                    variant: "destructive",
                });
                return;
            }
            setIsQuoting(true);
            try {
                const quoteEvent = new NDKEvent(ndk);
                quoteEvent.kind = 1;
                quoteEvent.content = comment;

                // Add 'e' tag referencing the quoted event using event.id
                quoteEvent.tags.push(["e", event.id, "", "mention"]);
                // Embed the nevent URI in the content
                quoteEvent.content += `\n\nnostr:${originalQuoteData.nevent}`;

                await quoteEvent.sign();
                await quoteEvent.publish();

                toast({ title: "Success", description: "Quote post published!" });
                setQuoteDataForDialog(null); // Close dialog on success
            } catch (error) {
                console.error("Failed to publish quote:", error);
                toast({
                    title: "Error",
                    description: `Failed to publish quote: ${error instanceof Error ? error.message : "Unknown error"}`,
                    variant: "destructive",
                });
            } finally {
                setIsQuoting(false);
            }
        },
        [ndk, event],
    ); // Added dependencies
    const handleRepostClick = useCallback(async () => {
        if (!ndk?.signer) {
            toast({ title: "Error", description: "Cannot repost. Signer not available.", variant: "destructive" });
            return;
        }
        setIsSendingReply(true); // Reuse sending state visually, or create a new one
        try {
            const repostEvent = new NDKEvent(ndk);
            repostEvent.kind = 6;
            // Content is often empty for reposts, but some clients add it
            // repostEvent.content = JSON.stringify(event.rawEvent()); // Example: Stringify original event
            repostEvent.tags = [
                ["e", event.id, "", ""], // Tag original event ID
                ["p", event.pubkey], // Tag original author pubkey
            ];

            await repostEvent.sign();
            await repostEvent.publish();
            toast({ title: "Success", description: "Reposted!" });
        } catch (error) {
            console.error("Failed to repost:", error);
            toast({
                title: "Error",
                description: `Failed to repost: ${error instanceof Error ? error.message : "Unknown error"}`,
                variant: "destructive",
            });
        } finally {
            setIsSendingReply(false); // Reuse sending state visually
        }
    }, [ndk, event]);

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

    const handleSendReplyClick = useCallback(async () => {
        // Add semicolon
        // Check if NDK instance and its signer are available
        if (!ndk?.signer || !internalReplyContent.trim()) {
            toast({
                title: "Error",
                description: "Cannot send reply. Signer not available or content empty.",
                variant: "destructive",
            });
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
                ["p", event.pubkey], // Tag author being replied to
            ];
            // Add root tag if the original event is also a reply
            const rootTag = event.tags.find((t) => t[0] === "e" && t[3] === "root");
            if (rootTag) {
                replyEvent.tags.push(rootTag); // Keep the root tag
                // Ensure the direct reply tag is marked as 'reply'
                const replyTagIndex = replyEvent.tags.findIndex((t) => t[0] === "e" && t[1] === event.id);
                if (replyTagIndex !== -1 && replyEvent.tags[replyTagIndex].length < 4) {
                    replyEvent.tags[replyTagIndex][3] = "reply";
                }
            } else {
                // If original is not a reply, mark its 'e' tag as root
                const replyTagIndex = replyEvent.tags.findIndex((t) => t[0] === "e" && t[1] === event.id);
                if (replyTagIndex !== -1) {
                    replyEvent.tags[replyTagIndex][3] = "root";
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
            toast({
                title: "Error",
                description: `Failed to send reply: ${error instanceof Error ? error.message : "Unknown error"}`,
                variant: "destructive",
            });
        } finally {
            setIsSendingReply(false);
        }
    }, [ndk, event, internalReplyContent]); // Removed signer from dependencies

    const handleZapClick = useCallback(async () => {
        // Basic Zap Implementation (Placeholder)
        setIsZapping(true);
        console.log("Attempting to zap event:", event.id, "by author:", event.pubkey);
        toast({ title: "Zap", description: "Zap functionality not fully implemented yet." });
        await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate async operation
        setIsZapping(false);
    }, [event]);
    const handleCopyId = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(event.encode());
            toast({ title: "Success", description: "Event ID (nevent) copied to clipboard!" });
        } catch (err) {
            console.error("Failed to copy event ID:", err);
            toast({ title: "Error", description: "Could not copy event ID.", variant: "destructive" });
        }
    }, [event]);

    const handleShowRawEvent = useCallback(() => {
        setShowRawEventDialog(true);
    }, []);

    // --- End Internal Handlers ---

    return (
        <>
            {" "}
            {/* Wrap in Fragment */}
            <div className="border-b border-border pb-3 last:border-0">
                <div className="flex items-start gap-3">
                    <UserAvatar pubkey={event.pubkey} size="lg" />
                    <div className="flex-1">
                        <div className="flex items-center gap-1">
                            <span className="font-medium text-sm">{UserDisplayName}</span>
                            <span className="text-xs text-muted-foreground">@{UserHandle.substring(0, 8)}...</span>
                        </div>

                        {!skipTaggedTask && <TaggedTask event={event} />}
                        
                        <p className="text-sm mt-1 whitespace-pre-wrap">{event.content}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{formatTimestamp(event.created_at)}</span>
                            {/* Add other metadata like relays if needed */}
                        </div>
                        <div className="flex items-center justify-between gap-3 mt-2">
                            {" "}
                            {/* Add justify-between */}
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
                                                    {repostCount > 0 && <span className="text-xs">{repostCount}</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-48 p-2">
                                                <div className="grid gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        className="justify-start h-8 px-2 text-sm"
                                                        onClick={handleRepostClick} // Use internal handler
                                                    >
                                                        <Repeat className="h-3.5 w-3.5 mr-2" />
                                                        Repost
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        className="justify-start h-8 px-2 text-sm"
                                                        onClick={handleOpenQuoteDialog} // Use new handler to open dialog
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

                                    {/* Right-aligned buttons */}
                                    <div className="flex items-center gap-1">
                                        {onCreateIssue && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="rounded-md hover:bg-secondary h-8 px-2"
                                                onClick={() => onCreateIssue(event.content)}
                                                title="Create Issue from Note"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="rounded-md hover:bg-secondary h-8 w-8"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">More options</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={handleCopyId}>
                                                    <Copy className="mr-2 h-4 w-4" />
                                                    <span>Copy Event ID</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={handleShowRawEvent}>
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    <span>Show Raw Event</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {/* Render the Quote Post Dialog */}
            <QuotePostDialog
                quoting={quoteDataForDialog}
                onClose={() => setQuoteDataForDialog(null)}
                onQuote={handleQuoteSubmit} // Pass the internal submit handler
                // Pass isQuoting state if QuotePostDialog is updated to show loading
                // isPosting={isQuoting}
            />

            {/* Raw Event Dialog */}
            <Dialog open={showRawEventDialog} onOpenChange={setShowRawEventDialog}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Raw Nostr Event</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 max-h-[60vh] overflow-auto rounded-md bg-muted p-4">
                        <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                            {JSON.stringify(event.rawEvent(), null, 2)}
                        </pre>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
