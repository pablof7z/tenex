import { NDKKind, useNDK, useSubscribe, useProfileValue, NDKSubscriptionCacheUsage } from "@nostr-dev-kit/ndk-hooks";
import type { NDKEvent } from "@nostr-dev-kit/ndk-hooks";
import type { NDKProject } from "@nostr-dev-kit/ndk-hooks";
import { ChevronDown, ChevronRight, Send, Reply } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { StatusUpdate } from "./tasks/StatusUpdate";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface MessageWithRepliesProps {
    event: NDKEvent;
    project: NDKProject;
}

// Component for reply avatars
const ReplyAvatar = memo(function ReplyAvatar({ pubkey }: { pubkey: string }) {
    const profile = useProfileValue(pubkey);
    
    return (
        <Avatar className="w-6 h-6 border-2 border-white">
            <AvatarImage src={profile?.image} alt={profile?.name || "User"} />
            <AvatarFallback className="text-[10px] bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                {profile?.name?.charAt(0).toUpperCase() ||
                    pubkey.slice(0, 2).toUpperCase()}
            </AvatarFallback>
        </Avatar>
    );
});


export const MessageWithReplies = memo(function MessageWithReplies({
    event,
    project,
}: MessageWithRepliesProps) {
    const { ndk } = useNDK();
    const [showReplies, setShowReplies] = useState(false);
    const [replyToEvent, setReplyToEvent] = useState<NDKEvent | null>(null);
    const [replyInput, setReplyInput] = useState("");
    const [isSending, setIsSending] = useState(false);

    // Subscribe to replies that e-tag this event (NIP-22 threading)
    const { events: directReplies } = useSubscribe(
        event.kind === NDKKind.GenericReply
            ? [
                  {
                      kinds: [NDKKind.GenericReply],
                      "#e": [event.id],
                  },
              ]
            : false,
        { cacheUsage: NDKSubscriptionCacheUsage.ONLY_CACHE },
        [event.id]
    );

    // Sort replies by timestamp
    const sortedReplies = useMemo(() => {
        if (!directReplies || directReplies.length === 0) return [];
        
        // Filter to only include events that directly e-tag this event
        const filtered = directReplies.filter(reply => {
            const eTags = reply.tags?.filter(tag => tag[0] === "e");
            return eTags?.some(tag => tag[1] === event.id);
        });
        
        return filtered.sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0));
    }, [directReplies, event.id]);

    const handleReply = useCallback((targetEvent: NDKEvent) => {
        setReplyToEvent(targetEvent);
        setShowReplies(true);
    }, []);

    const handleSendReply = useCallback(async () => {
        if (!replyInput.trim() || !ndk?.signer || isSending || !replyToEvent) return;

        setIsSending(true);
        try {
            const replyEvent = replyToEvent.reply();
            replyEvent.content = replyInput.trim();
            
            // Add project tag
            replyEvent.tags.push(["a", project.tagId()]);
            
            await replyEvent.publish();
            
            setReplyInput("");
            setReplyToEvent(null);
        } catch (error) {
            console.error("Failed to send reply:", error);
        } finally {
            setIsSending(false);
        }
    }, [replyInput, ndk, replyToEvent, isSending, project]);

    const handleKeyPress = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendReply();
            }
        },
        [handleSendReply]
    );

    // Count for replies display
    const replyCount = useMemo(() => {
        if (!directReplies) return 0;
        
        // Count events that directly e-tag this event
        return directReplies.filter(reply => {
            const eTags = reply.tags?.filter(tag => tag[0] === "e");
            return eTags?.some(tag => tag[1] === event.id);
        }).length;
    }, [directReplies, event.id]);

    return (
        <div className="group">
            <StatusUpdate event={event} onReply={() => handleReply(event)} />
            
            {/* Reply count and toggle - Slack style */}
            {replyCount > 0 && (
                <div className="pl-11 mt-2">
                    <button
                        type="button"
                        onClick={() => setShowReplies(!showReplies)}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors font-medium"
                    >
                        <div className="flex -space-x-2">
                            {/* Show up to 3 user avatars who replied */}
                            {sortedReplies.slice(0, 3).map((reply, idx) => (
                                <div key={reply.id} style={{ zIndex: 3 - idx }}>
                                    <ReplyAvatar pubkey={reply.pubkey} />
                                </div>
                            ))}
                        </div>
                        <span>
                            {replyCount} {replyCount === 1 ? "reply" : "replies"}
                        </span>
                        {showReplies ? (
                            <ChevronDown className="w-4 h-4" />
                        ) : (
                            <ChevronRight className="w-4 h-4" />
                        )}
                    </button>
                </div>
            )}

            {/* Thread replies - Slack style */}
            {showReplies && sortedReplies.length > 0 && (
                <div className="pl-11 mt-2">
                    <div className="border-l-2 border-gray-300/50 pl-3">
                        {sortedReplies.map(reply => (
                            <div key={reply.id} className="relative -ml-3">
                                <MessageWithReplies
                                    event={reply}
                                    project={project}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Reply input */}
            {replyToEvent && (
                <div className="pl-11 mt-2">
                    <div className="bg-muted/50 p-2 rounded mb-2">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Reply className="w-3 h-3" />
                            Replying to {replyToEvent.id === event.id ? "this message" : "a reply"}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <textarea
                            value={replyInput}
                            onChange={(e) => setReplyInput(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Write a reply..."
                            className="flex-1 min-h-[60px] p-2 text-sm bg-background border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <div className="flex flex-col gap-1">
                            <Button
                                size="sm"
                                onClick={handleSendReply}
                                disabled={!replyInput.trim() || isSending}
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    setReplyToEvent(null);
                                    setReplyInput("");
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});